import OpenAI from 'openai';
import { getDb } from '../db/client';
import { pgeUsage } from '../db/schema';

async function generateEnhancedNem3Analysis(
  openai: OpenAI,
  model: string,
  system_capacity: number,
  battery_capacity: number,
  projected_savings: number,
  new_system_cost: number
): Promise<string> {
  const prompt = `
    **NEM 3.0 Financial Analysis**

    **System Configuration:**
    *   Solar System Capacity: ${system_capacity} kW
    *   Battery Storage Capacity: ${battery_capacity} kWh

    **Financial Overview:**
    *   Estimated System Cost: ${new_system_cost.toFixed(2)}
    *   Projected Annual Savings: ${projected_savings.toFixed(2)}

    **Detailed Analysis:**

    1.  **Return on Investment (ROI):**
        *   Calculate the simple payback period.
        *   Discuss the expected ROI over the 25-year lifespan of the system, considering factors like panel degradation and potential electricity rate inflation.

    2.  **Battery Dispatch Strategy:**
        *   Explain the optimal battery dispatch strategy to maximize savings under NEM 3.0's time-of-use rates.
        *   Discuss how the battery can be used for both self-consumption of solar energy and to avoid high-cost peak grid power.

    3.  **Impact of Self-Consumption:**
        *   Analyze the importance of self-consuming solar energy to reduce reliance on the grid.
        *   Provide actionable recommendations for shifting energy usage to align with solar production hours.

    4.  **Risks and Considerations:**
        *   Outline potential risks, such as changes in electricity rates, system maintenance costs, and the accuracy of savings projections.
        *   Provide a balanced view of the investment, including both the potential benefits and drawbacks.

    **Conclusion:**

    Provide a concluding summary of whether this system configuration is a sound financial investment for a homeowner in California under NEM 3.0.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a solar energy financial analyst specializing in California NEM policies.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
    });
    
    return completion.choices[0]?.message?.content || 'Analysis could not be generated.';
  } catch (error) {
    console.error('Error generating NEM 3.0 analysis:', error);
    return 'AI analysis could not be generated at this time.';
  }
}

export async function handleNem3Model(request: Request, env: Env): Promise<Response> {
  const { systemCapacity, batteryCapacity } = (await request.json()) as {
    systemCapacity?: number;
    batteryCapacity?: number;
  };

  if (!systemCapacity) {
    return new Response(JSON.stringify({ error: 'missing systemCapacity' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const solarCostPerWatt = 3;
  const batteryCostPerKwh = 800;

  const newSystemCost = systemCapacity * 1000 * solarCostPerWatt + (batteryCapacity || 0) * batteryCostPerKwh;

  const db = getDb(env.DB);
  
  // Fetch historical usage data to project savings more accurately
  // Filter out records with null usage values to ensure accurate calculations
  const usageRecords = await db.select({ usage: pgeUsage.usage }).from(pgeUsage);
  const validUsageRecords = usageRecords.filter((r): r is { usage: number } => r.usage !== null);
  const totalUsage = validUsageRecords.reduce((acc, r) => acc + r.usage, 0);
  const averageDailyUsage = validUsageRecords.length > 0 ? totalUsage / 365 : 0;

  // A more sophisticated savings projection would model the interaction between solar, battery, and usage.
  // For now, we'll use a more refined estimate.
  const projectedSavings = Math.min(averageDailyUsage, systemCapacity * 4) * 365 * 0.3; // Assume 4 kWh/kW/day average production, $0.30/kWh

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

  const analysis = await generateEnhancedNem3Analysis(
    openai,
    model,
    systemCapacity,
    batteryCapacity || 0,
    projectedSavings,
    newSystemCost
  );

  return new Response(JSON.stringify({ newSystemCost, projectedSavings, analysis }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
