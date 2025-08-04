import { execute } from '../db/client';

export interface SolarTestRow {
  date: string;
  value: number;
  notes?: string;
}

export async function handleUploadSolarTest(request: Request, env: Env): Promise<Response> {
  const rows: SolarTestRow[] = await request.json();
  let inserted = 0;
  for (const row of rows) {
    if (!row.date || typeof row.value !== 'number') continue;
    await execute(env.DB, 'INSERT OR REPLACE INTO solar_test (date, value, notes) VALUES (?, ?, ?)', [row.date, row.value, row.notes ?? null]);
    inserted++;
  }
  return new Response(JSON.stringify({ inserted }), { headers: { 'Content-Type': 'application/json' } });
}
