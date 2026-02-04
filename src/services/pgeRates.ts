import { getDb } from '../db/client';
import { pgeRates } from '../db/schema';
import OpenAI from 'openai';
import { desc, between, like } from 'drizzle-orm';

/**
 * Handles the request to refresh PGE rates using AI to provide typical rate estimates.
 * Note: This endpoint generates estimated PG&E EV2 rates using AI rather than scraping actual PDFs.
 */
export async function handleRefreshPgeRates(request: Request, env: Env): Promise<Response> {
  let requestBody: { url?: string } | null = null;
  try {
    requestBody = await request.json();
  } catch (error) {
    // Allow empty body
  }

  // Store the reference URL for record-keeping (not actually fetched)
  const sourceUrl = requestBody?.url || 'https://www.pge.com/tariffs/assets/pdf/tariffbook/ELEC_SCHEDS_EV2%20(Sch).pdf';

  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const model = env.OPENAI_MODEL || 'gpt-4o-mini';

  const prompt = `
    You are an expert on California utility rates. Provide typical PG&E EV2 electricity rate information.
    
    **Instructions:**
    1. Provide electricity rates for **summer** and **winter** seasons. For each season, provide the cost per kWh for **peak**, **partial-peak**, and **off-peak** periods.
    2. Use today's date as the **effective date**.
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
        return new Response(JSON.stringify({ error: 'Failed to extract all required fields.' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    const db = getDb(env.DB);
    
    // Upsert the data using Drizzle
    await db.insert(pgeRates)
      .values({
        effectiveDate: ratesData.effectiveDate,
        expirationDate: ratesData.expirationDate,
        sourceUrl: sourceUrl,
        ratesJson: JSON.stringify(ratesData.rates)
      })
      .onConflictDoUpdate({
        target: pgeRates.effectiveDate,
        set: {
          expirationDate: ratesData.expirationDate,
          sourceUrl: sourceUrl,
          ratesJson: JSON.stringify(ratesData.rates)
        }
      });

    return new Response(JSON.stringify({ success: true, data: ratesData }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error calling OpenAI API or processing response:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred.', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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

    const db = getDb(env.DB);

    try {
        let query = db.select().from(pgeRates);
        
        // Build query based on filters
        let results;
        if (startDate && endDate) {
            results = await query
              .where(between(pgeRates.effectiveDate, startDate, endDate))
              .orderBy(desc(pgeRates.effectiveDate));
        } else if (year) {
            results = await query
              .where(like(pgeRates.effectiveDate, `${year}%`))
              .orderBy(desc(pgeRates.effectiveDate));
        } else {
            results = await query.orderBy(desc(pgeRates.effectiveDate));
        }

        let processedResults = results.map(row => {
            const rates = JSON.parse(row.ratesJson);
            return {
                effectiveDate: row.effectiveDate,
                expirationDate: row.expirationDate,
                sourceUrl: row.sourceUrl,
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
        return new Response(JSON.stringify({ error: 'Failed to fetch rates.', details: error.message }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
    }
}


/**
 * Handles manual insertion or update of PGE rates.
 */
export async function handleUpdatePgeRates(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Expected POST' }), { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { effectiveDate, expirationDate, sourceUrl, rates } = await request.json<any>();

        if (!effectiveDate || !expirationDate || !rates) {
            return new Response(JSON.stringify({ error: 'Missing required fields: effectiveDate, expirationDate, and rates are required.' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
        }

        // Basic validation of the rates object
        if (typeof rates !== 'object' || (!rates.summer && !rates.winter)) {
            return new Response(JSON.stringify({ error: 'Invalid "rates" object structure.' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = getDb(env.DB);
        
        await db.insert(pgeRates)
          .values({
            effectiveDate,
            expirationDate,
            sourceUrl: sourceUrl || null,
            ratesJson: JSON.stringify(rates)
          })
          .onConflictDoUpdate({
            target: pgeRates.effectiveDate,
            set: {
              expirationDate,
              sourceUrl: sourceUrl || null,
              ratesJson: JSON.stringify(rates)
            }
          });

        return new Response(JSON.stringify({ success: true }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Error updating PGE rates:', error);
        return new Response(JSON.stringify({ error: 'Failed to update rates.', details: error.message }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
    }
}
