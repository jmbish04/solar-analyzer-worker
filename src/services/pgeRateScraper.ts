import { execute } from '../db/client';

// This is a placeholder for a more robust scraping solution.
// In a real-world scenario, you would use a library like Cheerio or Puppeteer
// to scrape the data from the PGE website.
const MOCK_RATES = [
  { nem_version: 'NEM 2.0', rate_name: 'E-TOU-C Off-Peak', rate: 0.25 },
  { nem_version: 'NEM 2.0', rate_name: 'E-TOU-C Peak', rate: 0.35 },
  { nem_version: 'NEM 3.0', rate_name: 'E-ELEC Off-Peak', rate: 0.20 },
  { nem_version: 'NEM 3.0', rate_name: 'E-ELEC Peak', rate: 0.40 },
];

export async function handlePgeRateScraper(request: Request, env: Env): Promise<Response> {
  let inserted = 0;
  for (const rate of MOCK_RATES) {
    try {
      await execute(
        env.DB,
        'INSERT INTO pge_rates (nem_version, rate_name, rate) VALUES (?, ?, ?)',
        [rate.nem_version, rate.rate_name, rate.rate]
      );
      inserted++;
    } catch (e: any) {
      // Ignore unique constraint errors
      if (e.message.includes('UNIQUE constraint failed')) {
        continue;
      }
      throw e;
    }
  }

  return new Response(JSON.stringify({ inserted }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
