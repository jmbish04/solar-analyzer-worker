import { getDb } from '../db/client';
import { sunriseSunset } from '../db/schema';
import { dateRange } from '../utils';
import { and, gte, lte } from 'drizzle-orm';

type SunData = {
  sunrise: string;
  sunset: string;
  hours: number;
};

async function fetchSun(date: string, lat: number, lon: number): Promise<SunData | null> {
  const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${date}&formatted=0`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Sunrise API request failed with status ${resp.status}`);
      return null;
    }
    const data = await resp.json<any>();
    const sunrise = data.results.sunrise;
    const sunset = data.results.sunset;
    const sunHours = (new Date(sunset).valueOf() - new Date(sunrise).valueOf()) / 3600000;
    return { sunrise, sunset, hours: sunHours };
  } catch (e: any) {
    console.error(`Sunrise API request failed with error: ${e.message}`);
    return null;
  }
}

export async function handleBackfillSunrise(request: Request, env: Env): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get('startDate');
  const endStr = searchParams.get('endDate');
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lon = parseFloat(searchParams.get('lon') || '0');

  if (!startStr || !endStr) {
    return new Response('missing start or end', { status: 400 });
  }

  const db = getDb(env.DB);
  const start = new Date(startStr);
  const end = new Date(endStr);
  const dates = dateRange(start, end);
  let inserted = 0;

  const existingRecords = await db.select({ date: sunriseSunset.date })
    .from(sunriseSunset)
    .where(and(gte(sunriseSunset.date, startStr), lte(sunriseSunset.date, endStr)));
  const existingDates = new Set(existingRecords.map(r => r.date));

  const promises = dates.map(async (date) => {
    if (existingDates.has(date)) return;

    const result = await fetchSun(date, lat, lon);
    if (!result) return;

    await db.insert(sunriseSunset).values({
      date,
      sunrise: result.sunrise,
      sunset: result.sunset,
      sunHours: result.hours
    });
    inserted++;
  });

  await Promise.all(promises);

  return new Response(JSON.stringify({ inserted }), { headers: { 'Content-Type': 'application/json' } });
}
