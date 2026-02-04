import { getDb } from '../db/client';
import { pvwatts, sunriseSunset } from '../db/schema';
import { desc } from 'drizzle-orm';

export async function handleDataStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const dataType = url.pathname.split('/').pop();

  if (!dataType || (dataType !== 'sunrise-sunset' && dataType !== 'pvwatts')) {
    return new Response(JSON.stringify({ error: "Invalid data type specified. Use 'sunrise-sunset' or 'pvwatts'." }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = getDb(env.DB);

  try {
    let lastRecordedDate: string | null = null;

    if (dataType === 'pvwatts') {
      const result = await db
        .select({ date: pvwatts.date })
        .from(pvwatts)
        .orderBy(desc(pvwatts.date))
        .limit(1);
      lastRecordedDate = result[0]?.date || null;
    } else {
      const result = await db
        .select({ date: sunriseSunset.date })
        .from(sunriseSunset)
        .orderBy(desc(sunriseSunset.date))
        .limit(1);
      lastRecordedDate = result[0]?.date || null;
    }

    return new Response(JSON.stringify({ dataType, lastRecordedDate }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error fetching data status for ${dataType}:`, error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
