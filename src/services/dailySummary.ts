import { getDb } from '../db/client';
import { pgeUsage, pvwattsHourly } from '../db/schema';
import OpenAI from 'openai';
import { eq } from 'drizzle-orm';

interface HourRecord {
  hour: string;
  usage: number;
  pv: number;
}

async function generateDailySummary(openai: OpenAI, model: string, date: string, hours: HourRecord[]): Promise<string> {
  const prompt = `
    Analyze the following hourly energy data for ${date}.
    The data includes electricity usage and solar PV generation in watt-hours.

    Hourly Data:
    ${hours.map(h => `Hour: ${h.hour}, Usage: ${h.usage.toFixed(2)} Wh, PV Generation: ${h.pv.toFixed(2)} Wh`).join('\n')}

    Provide a brief summary of the energy profile for this day.
    Highlight the peak usage hours and the peak PV generation hours.
    Identify if the home was a net producer or consumer of energy for the day.
    Keep the tone friendly and informative.
    The summary should be concise and no more than 2 paragraphs.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an energy analyst helping homeowners understand their solar energy production and consumption patterns.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
    });
    
    return completion.choices[0]?.message?.content || 'Summary could not be generated.';
  } catch (error) {
    console.error('Error generating daily summary:', error);
    return 'AI summary could not be generated at this time.';
  }
}

export async function handleDailySummary(request: Request, env: Env): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  if (!dateStr) {
    return new Response(JSON.stringify({ error: 'missing date' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = getDb(env.DB);

  // Get usage data for the date
  const usageData = await db
    .select()
    .from(pgeUsage)
    .where(eq(pgeUsage.date, dateStr))
    .orderBy(pgeUsage.hour);

  // Get PV data for the date
  const pvData = await db
    .select()
    .from(pvwattsHourly)
    .where(eq(pvwattsHourly.date, dateStr));

  // Create a map for quick PV lookup
  const pvMap = new Map<string, number>();
  for (const pv of pvData) {
    pvMap.set(pv.hour, pv.acWh ?? 0);
  }

  // Combine the data
  const hours: HourRecord[] = usageData.map(u => ({
    hour: u.hour,
    usage: u.usage ?? 0,
    pv: pvMap.get(u.hour) ?? 0
  }));

  if (hours.length === 0) {
    return new Response(JSON.stringify({ error: 'No data for this date' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

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

  const summary = await generateDailySummary(openai, model, dateStr, hours);

  return new Response(JSON.stringify({ date: dateStr, summary, hours }), {
    headers: { 'Content-Type': 'application/json' },
  });
}