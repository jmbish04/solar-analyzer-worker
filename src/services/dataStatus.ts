import { queryDB } from '../db/client';

interface DateRecord {
  date: string;
}

export async function handleDataStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const dataType = url.pathname.split('/').pop();

  if (!dataType || (dataType !== 'sunrise-sunset' && dataType !== 'pvwatts')) {
    return new Response("Invalid data type specified. Use 'sunrise-sunset' or 'pvwatts'.", { status: 400 });
  }

  const tableName = dataType === 'sunrise-sunset' ? 'sunrise_sunset' : 'pvwatts';

  try {
    const result = await queryDB<DateRecord>(
      env.DB,
      `SELECT MAX(date) as date FROM ${tableName}`
    );

    const lastRecordedDate = result[0]?.date || null;

    return new Response(JSON.stringify({ dataType, lastRecordedDate }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error fetching data status for ${dataType}:`, error);
    return new Response('Internal server error', { status: 500 });
  }
}
