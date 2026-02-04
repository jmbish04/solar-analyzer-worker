import { getDb } from '../db/client';
import { pvwatts, pvwattsHourly } from '../db/schema';
import { dateRange, MILLISECONDS_IN_DAY } from '../utils';
import { and, gte, lte } from 'drizzle-orm';

async function fetchYearData(env: Env, year: number, lat: number, lon: number): Promise<number[] | null> {
  const url = `https://developer.nrel.gov/api/pvwatts/v8.json?api_key=${env.PVWATTS_API_KEY}&lat=${lat}&lon=${lon}&system_capacity=1&azimuth=180&tilt=0&array_type=1&module_type=1&losses=10&timeframe=hourly&year=${year}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`PVWatts request failed with status ${resp.status}`);
      return null;
    }
    const data = await resp.json<any>();
    return data.outputs.ac as number[];
  } catch (e: any) {
    console.error(`PVWatts request failed with error: ${e.message}`);
    return null;
  }
}

export async function handleBackfillPvwatts(request: Request, env: Env): Promise<Response> {
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

  const existingRecords = await db.select({ date: pvwatts.date })
    .from(pvwatts)
    .where(and(gte(pvwatts.date, startStr), lte(pvwatts.date, endStr)));
  const existingDates = new Set(existingRecords.map(r => r.date));

  const years = new Set(dates.map(d => d.slice(0, 4)));
  const yearData: Record<string, number[] | null> = {};
  for (const y of years) {
    yearData[y] = await fetchYearData(env, parseInt(y), lat, lon);
  }

  for (const date of dates) {
    if (existingDates.has(date)) continue;

    const year = date.slice(0, 4);
    const yearArray = yearData[year];
    if (!yearArray) continue;

    const dayOfYear = Math.floor((new Date(date).valueOf() - new Date(`${year}-01-01`).valueOf()) / MILLISECONDS_IN_DAY);
    const hours = yearArray.slice(dayOfYear * 24, dayOfYear * 24 + 24);
    const dayAc = hours.reduce((a, b) => a + (b || 0), 0);

    await db.insert(pvwatts).values({ date, acWh: dayAc });

    const hourlyData = [];
    for (let h = 0; h < 24; h++) {
      const hour = h.toString().padStart(2, '0');
      hourlyData.push({ date, hour, acWh: hours[h] || 0 });
    }
    await db.insert(pvwattsHourly).values(hourlyData);
    inserted++;
  }

  return new Response(JSON.stringify({ inserted }), { headers: { 'Content-Type': 'application/json' } });
}