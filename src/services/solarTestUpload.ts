import { getDb } from '../db/client';
import { solarTest } from '../db/schema';

export interface SolarTestRow {
  date: string;
  value: number;
  notes?: string;
}

export async function handleUploadSolarTest(request: Request, env: Env): Promise<Response> {
  const rows: SolarTestRow[] = await request.json();
  const db = getDb(env.DB);
  let inserted = 0;

  for (const row of rows) {
    if (!row.date || typeof row.value !== 'number') continue;
    
    await db.insert(solarTest)
      .values({ date: row.date, value: row.value, notes: row.notes ?? null })
      .onConflictDoUpdate({
        target: solarTest.date,
        set: { value: row.value, notes: row.notes ?? null }
      });
    inserted++;
  }
  return new Response(JSON.stringify({ inserted }), { headers: { 'Content-Type': 'application/json' } });
}
