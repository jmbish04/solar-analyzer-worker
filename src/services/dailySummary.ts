import { queryDB } from '../db/client';
import OpenAI from 'openai';

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
    return new Response('missing date', { status: 400 });
  }

  const hours = await queryDB<HourRecord>(
    env.DB,
    `SELECT u.hour, u.usage, coalesce(p.ac_wh, 0) as pv
     FROM pge_usage u
     LEFT JOIN pvwatts_hourly p ON u.date = p.date AND u.hour = p.hour
     WHERE u.date = ?
     ORDER BY u.hour`,
    [dateStr]
  );

  if (hours.length === 0) {
    return new Response('No data for this date', { status: 404 });
  }

  if (!env.OPENAI_API_KEY) {
    return new Response('OPENAI_API_KEY is not configured', { status: 500 });
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