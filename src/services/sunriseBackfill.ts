import { execute, queryDB } from '../db/client';
import { dateRange } from '../utils';

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

  const start = new Date(startStr);
  const end = new Date(endStr);
  const dates = dateRange(start, end);
  let inserted = 0;

  const existingDates = new Set((await queryDB<{ date: string }>(env.DB, `SELECT date FROM sunrise_sunset WHERE date >= ? AND date <= ?`, [startStr, endStr])).map(r => r.date));

  const promises = dates.map(async (date) => {
    if (existingDates.has(date)) return;

    const result = await fetchSun(date, lat, lon);
    if (!result) return;

    await execute(env.DB, 'INSERT INTO sunrise_sunset (date, sunrise, sunset, sun_hours) VALUES (?, ?, ?, ?)', [date, result.sunrise, result.sunset, result.hours]);
    inserted++;
  });

  await Promise.all(promises);

  return new Response(JSON.stringify({ inserted }), { headers: { 'Content-Type': 'application/json' } });
}
