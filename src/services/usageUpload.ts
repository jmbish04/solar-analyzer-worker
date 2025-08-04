import { execute } from '../db/client';

function parseCsv(data: string): Array<Record<string, string>> {
  const [headerLine, ...lines] = data.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map(h => h.trim());
  return lines.map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => row[h] = values[i]);
    return row;
  });
}

function to24Hour(time: string): string {
  const [hour, minute] = time.split(':');
  return hour.padStart(2, '0');
}

export async function handleUploadPgeUsage(request: Request, env: Env): Promise<Response> {
  const text = await request.text();
  let rows: Array<Record<string, string>> = [];
  try {
    const json = JSON.parse(text);
    rows = Array.isArray(json) ? json : [];
  } catch {
    rows = parseCsv(text);
  }

  let inserted = 0;
  for (const row of rows) {
    const type = row['TYPE'] || row['type'];
    if (!type || !type.toLowerCase().includes('electric')) continue;
    const date = row['DATE'] || row['date'];
    const start = row['START TIME'] || row['start'];
    const usage = parseFloat(row['USAGE (kWh)'] || row['usage']);
    if (!date || !start || isNaN(usage)) continue;
    const hour = to24Hour(start);
    await execute(env.DB, 'INSERT OR IGNORE INTO pge_usage (date, hour, usage, units) VALUES (?, ?, ?, ?)', [date, hour, usage, 'kWh']);
    inserted++;
  }
  return new Response(JSON.stringify({ inserted }), { headers: { 'Content-Type': 'application/json' } });
}
