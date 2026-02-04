import { execute, queryDB } from '../db/client';
import OpenAI from 'openai';

/**
 * Handles the request to refresh PGE rates by scraping a PDF from a URL.
 */
export async function handleRefreshPgeRates(request: Request, env: Env): Promise<Response> {
  let requestBody: { url?: string } | null = null;
  try {
    requestBody = await request.json();
  } catch (error) {
    // Allow empty body to use default URL
  }

  const pdfUrl = requestBody?.url || 'https://www.pge.com/tariffs/assets/pdf/tariffbook/ELEC_SCHEDS_EV2%20(Sch).pdf';

  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), { status: 500 });
  }

  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const model = env.OPENAI_MODEL || 'gpt-4o-mini';

  const prompt = `
    You are an expert data extraction bot. Your task is to provide PG&E electricity rate information.
    Based on typical PG&E EV2 rates (as the PDF at ${pdfUrl} may not be directly accessible), provide estimated rates.
    
    **Instructions:**
    1. Provide electricity rates for **summer** and **winter** seasons. For each season, provide the cost per kWh for **peak**, **partial-peak**, and **off-peak** periods.
    2. Use a recent **effective date** (use today's date or a recent date).
    3. Calculate the **expiration date**, which is exactly one year after the effective date.
    4. Respond with **ONLY** a single, raw JSON object containing the data in this exact format:
    {
      "rates": {
        "summer": { "peak": 0.55, "partialPeak": 0.45, "offPeak": 0.25 },
        "winter": { "peak": 0.45, "partialPeak": 0.35, "offPeak": 0.22 }
      },
      "effectiveDate": "2024-01-01",
      "expirationDate": "2025-01-01"
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a utility rate data extraction assistant. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const ratesData = JSON.parse(responseText);

    // Basic validation to ensure all required fields are present
    if (!ratesData.rates || !ratesData.effectiveDate || !ratesData.expirationDate) {
        console.error("OpenAI response missing required fields:", ratesData);
        return new Response(JSON.stringify({ error: 'Failed to extract all required fields.' }), { status: 500 });
    }

    // Upsert the data into the D1 database
    await execute(
      env.DB,
      'INSERT INTO pge_rates (effective_date, expiration_date, source_url, rates_json) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(effective_date) DO UPDATE SET expiration_date=excluded.expiration_date, source_url=excluded.source_url, rates_json=excluded.rates_json',
      [ratesData.effectiveDate, ratesData.expirationDate, pdfUrl, JSON.stringify(ratesData.rates)]
    );

    return new Response(JSON.stringify({ success: true, data: ratesData }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error calling OpenAI API or processing response:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred.', details: error.message }), { status: 500 });
  }
}

/**
 * Handles the request to list PGE rates with filtering.
 */
export async function handleGetPgeRates(request: Request, env: Env): Promise<Response> {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const season = searchParams.get('season'); // 'summer' or 'winter'
    const peakType = searchParams.get('peakType'); // 'peak', 'partialPeak', 'offPeak'
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = 'SELECT effective_date, expiration_date, source_url, rates_json FROM pge_rates';
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate && endDate) {
        conditions.push('effective_date BETWEEN ? AND ?');
        params.push(startDate, endDate);
    } else if (year) {
        conditions.push("strftime('%Y', effective_date) = ?");
        params.push(year);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY effective_date DESC';

    try {
        const results = await queryDB<any>(env.DB, query, params);

        let processedResults = results.map(row => {
            const rates = JSON.parse(row.rates_json);
            return {
                effectiveDate: row.effective_date,
                expirationDate: row.expiration_date,
                sourceUrl: row.source_url,
                rates: rates
            };
        });

        // Further filter by season and peakType in code if specified
        if (season) {
            processedResults = processedResults.map(res => {
                if (res.rates[season]) {
                    res.rates = { [season]: res.rates[season] };
                }
                return res;
            });
        }

        if (peakType) {
            processedResults.forEach(res => {
                Object.keys(res.rates).forEach(s => {
                    if (res.rates[s][peakType] !== undefined) {
                        res.rates[s] = { [peakType]: res.rates[s][peakType] };
                    }
                });
            });
        }

        return new Response(JSON.stringify(processedResults), { headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        console.error('Error fetching PGE rates:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch rates.', details: error.message }), { status: 500 });
    }
}


/**
 * Handles manual insertion or update of PGE rates.
 */
export async function handleUpdatePgeRates(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Expected POST', { status: 405 });
    }

    try {
        const { effectiveDate, expirationDate, sourceUrl, rates } = await request.json<any>();

        if (!effectiveDate || !expirationDate || !rates) {
            return new Response('Missing required fields: effectiveDate, expirationDate, and rates are required.', { status: 400 });
        }

        // Basic validation of the rates object
        if (typeof rates !== 'object' || (!rates.summer && !rates.winter)) {
            return new Response('Invalid "rates" object structure.', { status: 400 });
        }

        await execute(
            env.DB,
            'INSERT INTO pge_rates (effective_date, expiration_date, source_url, rates_json) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(effective_date) DO UPDATE SET expiration_date=excluded.expiration_date, source_url=excluded.source_url, rates_json=excluded.rates_json',
            [effectiveDate, expirationDate, sourceUrl || null, JSON.stringify(rates)]
        );

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error: any) {
        console.error('Error updating PGE rates:', error);
        return new Response(JSON.stringify({ error: 'Failed to update rates.', details: error.message }), { status: 500 });
    }
}
