import { queryDB } from '../db/client';

interface HourRecord {
  hour: string;
  usage: number;
  pv: number;
}

async function generateDailySummary(ai: any, date: string, hours: HourRecord[]): Promise<string> {
  const model = ai;

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
    const result = await model.run('@cf/meta/llama-2-7b-chat-int8', { prompt });
    return result.response;
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

  const summary = await generateDailySummary(env.AI, dateStr, hours);

  return new Response(JSON.stringify({ date: dateStr, summary, hours }), {
    headers: { 'Content-Type': 'application/json' },
  });
}