import { queryDB } from '../db/client';

interface HourRecord {
  date: string;
  hour: string;
  usage: number;
  pv: number;
  expected_pv: number;
}

const OFF_PEAK = 0.25;
const PEAK = 0.35;

function rateForHour(h: number): number {
  return h >= 16 && h < 21 ? PEAK : OFF_PEAK;
}

export async function handleLossAnalysis(request: Request, env: Env): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');
  if (!startStr || !endStr) {
    return new Response('missing start or end', { status: 400 });
  }

  // This query assumes you have a table or view with expected PV generation
  // You may need to adjust this based on your actual schema
  const hours = await queryDB<HourRecord>(
    env.DB,
    `SELECT
       u.date,
       u.hour,
       u.usage,
       coalesce(p_actual.ac_wh, 0) as pv,
       coalesce(p_expected.ac_wh, 0) as expected_pv
     FROM pge_usage u
     LEFT JOIN pvwatts_hourly p_actual ON u.date = p_actual.date AND u.hour = p_actual.hour
     LEFT JOIN pvwatts_hourly_expected p_expected ON u.date = p_expected.date AND u.hour = p_expected.hour
     WHERE u.date BETWEEN ? AND ?
     ORDER BY u.date, u.hour`,
    [startStr, endStr]
  );

  let totalLoss = 0;
  const monthlyComparison = new Map<string, { month: string; expectedCost: number; actualCost: number }>();

  for (const h of hours) {
    const rate = rateForHour(parseInt(h.hour));
    const month = h.date.substring(0, 7);

    if (!monthlyComparison.has(month)) {
      monthlyComparison.set(month, { month, expectedCost: 0, actualCost: 0 });
    }
    const monthData = monthlyComparison.get(month)!;

    const actualNet = h.usage - h.pv;
    const expectedNet = h.usage - h.expected_pv;

    const actualCost = actualNet * rate;
    const expectedCost = expectedNet * rate;

    monthData.actualCost += actualCost;
    monthData.expectedCost += expectedCost;
  }

  const monthlyArray = Array.from(monthlyComparison.values());
  totalLoss = monthlyArray.reduce((acc, m) => acc + (m.actualCost - m.expectedCost), 0);

  return new Response(JSON.stringify({ totalLoss, monthlyComparison: monthlyArray }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
