import { getDb } from '../db/client';
import { solarConfig } from '../db/schema';
import { desc } from 'drizzle-orm';

// A simple function to verify the admin password from a request header.
async function verifyAdminPassword(request: Request, env: Env): Promise<boolean> {
  const password = request.headers.get('X-Admin-Password');
  
  if (!password) {
    return false; // No password header found
  }

  // Ensure ADMIN_PASSWORD is configured in the environment
  if (!env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not configured in the environment.');
    return false; // Internal server error state
  }

  return password === env.ADMIN_PASSWORD;
}


interface SolarConfigApi {
  panelCount: number;
  panelOutputWatts: number;
  systemCapacityKw: number;
  panelTilt: number;
  panelAzimuth: number;
  latitude: number;
  longitude: number;
}



export async function handleGetSolarConfig(request: Request, env: Env): Promise<Response> {
  try {
    // Add authentication check
    const isAuthorized = await verifyAdminPassword(request, env);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDb(env.DB);
    
    const dbResult = await db
      .select()
      .from(solarConfig)
      .orderBy(desc(solarConfig.timestamp))
      .limit(1);

    if (!dbResult || dbResult.length === 0) {
      return new Response(JSON.stringify({ error: 'Solar configuration not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const dbConfig = dbResult[0];
    
    // Validate that optional fields have values - if not, return error indicating incomplete config
    if (dbConfig.panelCount === null || dbConfig.panelOutputWatts === null || 
        dbConfig.latitude === null || dbConfig.longitude === null) {
      return new Response(JSON.stringify({ 
        error: 'Incomplete solar configuration. Missing required fields: panelCount, panelOutputWatts, latitude, or longitude.' 
      }), { 
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const apiConfig: SolarConfigApi = {
      panelCount: dbConfig.panelCount,
      panelOutputWatts: dbConfig.panelOutputWatts,
      systemCapacityKw: dbConfig.systemCapacityKw,
      panelTilt: dbConfig.panelTilt,
      panelAzimuth: dbConfig.panelAzimuth,
      latitude: dbConfig.latitude,
      longitude: dbConfig.longitude,
    };

    return new Response(JSON.stringify(apiConfig), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching solar config:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleUpdateSolarConfig(request: Request, env: Env): Promise<Response> {
  try {
    const isAuthorized = await verifyAdminPassword(request, env);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const config: SolarConfigApi = await request.json();

    // Basic validation
    if (
      typeof config.panelCount !== 'number' ||
      typeof config.panelOutputWatts !== 'number' ||
      typeof config.systemCapacityKw !== 'number' ||
      typeof config.panelTilt !== 'number' ||
      typeof config.panelAzimuth !== 'number'
    ) {
      return new Response(JSON.stringify({ error: 'Invalid configuration data' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDb(env.DB);
    
    await db.insert(solarConfig).values({
      panelCount: config.panelCount,
      panelOutputWatts: config.panelOutputWatts,
      systemCapacityKw: config.systemCapacityKw,
      panelTilt: config.panelTilt,
      panelAzimuth: config.panelAzimuth,
      latitude: config.latitude,
      longitude: config.longitude,
    });

    return new Response(JSON.stringify({ success: true, message: 'Configuration updated successfully' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error updating solar config:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
