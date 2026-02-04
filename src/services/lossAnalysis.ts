import { getDb } from '../db/client';
import { pgeUsage, pvwattsHourly, pvwattsHourlyExpected } from '../db/schema';
import { between } from 'drizzle-orm';

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
    return new Response(JSON.stringify({ error: 'missing start or end' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = getDb(env.DB);

  // Get usage data
  const usageData = await db
    .select()
    .from(pgeUsage)
    .where(between(pgeUsage.date, startStr, endStr))
    .orderBy(pgeUsage.date, pgeUsage.hour);

  // Get actual PV data
  const actualPvData = await db
    .select()
    .from(pvwattsHourly)
    .where(between(pvwattsHourly.date, startStr, endStr));

  // Get expected PV data
  const expectedPvData = await db
    .select()
    .from(pvwattsHourlyExpected)
    .where(between(pvwattsHourlyExpected.date, startStr, endStr));

  // Create maps for quick lookup
  const actualPvMap = new Map<string, number>();
  for (const pv of actualPvData) {
    actualPvMap.set(`${pv.date}-${pv.hour}`, pv.acWh ?? 0);
  }

  const expectedPvMap = new Map<string, number>();
  for (const pv of expectedPvData) {
    expectedPvMap.set(`${pv.date}-${pv.hour}`, pv.acWh ?? 0);
  }

  let totalLoss = 0;
  const monthlyComparison = new Map<string, { month: string; expectedCost: number; actualCost: number }>();

  for (const h of usageData) {
    const rate = rateForHour(parseInt(h.hour));
    const month = h.date.substring(0, 7);
    const key = `${h.date}-${h.hour}`;

    if (!monthlyComparison.has(month)) {
      monthlyComparison.set(month, { month, expectedCost: 0, actualCost: 0 });
    }
    const monthData = monthlyComparison.get(month)!;

    const usage = h.usage ?? 0;
    const pv = actualPvMap.get(key) ?? 0;
    const expectedPv = expectedPvMap.get(key) ?? 0;

    const actualNet = usage - pv;
    const expectedNet = usage - expectedPv;

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
