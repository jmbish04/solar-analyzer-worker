import { execute, queryDB } from '../db/client';
import { dateRange, MILLISECONDS_IN_DAY } from '../utils';

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

  const start = new Date(startStr);
  const end = new Date(endStr);
  const dates = dateRange(start, end);
  let inserted = 0;

  const existingDates = new Set((await queryDB<{ date: string }>(env.DB, `SELECT date FROM pvwatts WHERE date >= ? AND date <= ?`, [startStr, endStr])).map(r => r.date));

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

    await execute(env.DB, 'INSERT INTO pvwatts (date, ac_wh) VALUES (?, ?)', [date, dayAc]);

    const statements: D1PreparedStatement[] = [];
    for (let h = 0; h < 24; h++) {
      const hour = h.toString().padStart(2, '0');
      statements.push(
        env.DB.prepare('INSERT INTO pvwatts_hourly (date, hour, ac_wh) VALUES (?1, ?2, ?3)').bind(
          date,
          hour,
          hours[h] || 0
        )
      );
    }
    await env.DB.batch(statements);
    inserted++;
  }

  return new Response(JSON.stringify({ inserted }), { headers: { 'Content-Type': 'application/json' } });
}