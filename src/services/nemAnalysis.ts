import { queryDB } from '../db/client';
import OpenAI from 'openai';

interface HourRecord {
  date: string;
  hour: string;
  usage: number;
  pv: number;
}

const OFF_PEAK = 0.25;
const PEAK = 0.35;

function rateForHour(h: number): number {
  return h >= 16 && h < 21 ? PEAK : OFF_PEAK;
}

async function generateNemAnalysis(
  openai: OpenAI,
  model: string,
  costNEM2: number,
  costNEM3: number,
  diff: number
): Promise<string> {
  const prompt = `
    Analyze the following Net Energy Metering (NEM) cost comparison.
    NEM 2.0 Cost: ${costNEM2.toFixed(2)}
    NEM 3.0 Cost: ${costNEM3.toFixed(2)}
    Difference (NEM 3.0 - NEM 2.0): ${diff.toFixed(2)}

    Provide a brief analysis of what these results mean for a homeowner.
    Explain the key differences between NEM 2.0 and NEM 3.0 that lead to this result.
    Offer actionable recommendations for the homeowner to optimize their energy usage and costs under NEM 3.0.
    Keep the tone professional and easy to understand for a non-expert.
    The analysis should be concise and no more than 3 paragraphs.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an energy policy expert specializing in California solar net metering programs.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
    });
    
    return completion.choices[0]?.message?.content || 'Analysis could not be generated.';
  } catch (error) {
    console.error('Error generating NEM analysis:', error);
    return 'AI analysis could not be generated at this time.';
  }
}

export async function handleNemAnalysis(request: Request, env: Env): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');
  if (!startStr || !endStr) {
    return new Response('missing start or end', { status: 400 });
  }

  const hours = await queryDB<HourRecord>(
    env.DB,
    `SELECT u.date, u.hour, u.usage, coalesce(p.ac_wh, 0) as pv
     FROM pge_usage u
     LEFT JOIN pvwatts_hourly p ON u.date = p.date AND u.hour = p.hour
     WHERE u.date BETWEEN ? AND ?
     ORDER BY u.date, u.hour`,
    [startStr, endStr]
  );

  let costNEM2 = 0;
  let costNEM3 = 0;
  const detailedHours = [];
  for (const h of hours) {
    const rate = rateForHour(parseInt(h.hour));
    const net = h.usage - h.pv;
    let hourlyDiff = 0;

    if (net >= 0) {
      costNEM2 += net * rate;
      costNEM3 += net * rate;
    } else {
      const nem2Credit = net * rate; // negative credit
      const nem3Credit = net * rate * 0.75;
      costNEM2 += nem2Credit;
      costNEM3 += nem3Credit;
      hourlyDiff = nem3Credit - nem2Credit;
    }
    detailedHours.push({ ...h, hourlyDiff });
  }
  const diff = costNEM3 - costNEM2;

  if (!env.OPENAI_API_KEY) {
    return new Response('OPENAI_API_KEY is not configured', { status: 500 });
  }

  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
  
  const model = env.OPENAI_MODEL || 'gpt-4o-mini';

  const analysis = await generateNemAnalysis(openai, model, costNEM2, costNEM3, diff);

  return new Response(JSON.stringify({ costNEM2, costNEM3, diff, analysis, hours: detailedHours }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
