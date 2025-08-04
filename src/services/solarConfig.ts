import { queryDB, execute } from '../db/client';

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


interface SolarConfig {
  panelCount: number;
  panelOutputWatts: number;
  systemCapacityKw: number;
  panelTilt: number;
  panelAzimuth: number;
  latitude: number;
  longitude: number;
}

// DB schema uses snake_case
interface SolarConfigDB {
  panel_count: number;
  panel_output_watts: number;
  system_capacity_kw: number;
  panel_tilt: number;
  panel_azimuth: number;
  latitude: number;
  longitude: number;
}



export async function handleGetSolarConfig(request: Request, env: Env): Promise<Response> {
  try {
    // Add authentication check
    const isAuthorized = await verifyAdminPassword(request, env);
    if (!isAuthorized) {
      return new Response('Unauthorized', { status: 401 });
    }

    const dbResult = await queryDB<SolarConfigDB>(
      env.DB,
      `SELECT panel_count, panel_output_watts, system_capacity_kw, panel_tilt, panel_azimuth, latitude, longitude
       FROM solar_config
       ORDER BY timestamp DESC
       LIMIT 1`
    );

    if (!dbResult || dbResult.length === 0) {
      return new Response('Solar configuration not found', { status: 404 });
    }

    const dbConfig = dbResult[0];
    const apiConfig: SolarConfig = {
      panelCount: dbConfig.panel_count,
      panelOutputWatts: dbConfig.panel_output_watts,
      systemCapacityKw: dbConfig.system_capacity_kw,
      panelTilt: dbConfig.panel_tilt,
      panelAzimuth: dbConfig.panel_azimuth,
      latitude: dbConfig.latitude,
      longitude: dbConfig.longitude,
    };

    return new Response(JSON.stringify(apiConfig), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching solar config:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function handleUpdateSolarConfig(request: Request, env: Env): Promise<Response> {
  try {
    const isAuthorized = await verifyAdminPassword(request, env);
    if (!isAuthorized) {
      return new Response('Unauthorized', { status: 401 });
    }

    const config: SolarConfig = await request.json();

    // Basic validation
    if (
      typeof config.panelCount !== 'number' ||
      typeof config.panelOutputWatts !== 'number' ||
      typeof config.systemCapacityKw !== 'number' ||
      typeof config.panelTilt !== 'number' ||
      typeof config.panelAzimuth !== 'number'
    ) {
      return new Response('Invalid configuration data', { status: 400 });
    }

    await execute(
      env.DB,
      `INSERT INTO solar_config (panel_count, panel_output_watts, system_capacity_kw, panel_tilt, panel_azimuth, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        config.panelCount,
        config.panelOutputWatts,
        config.systemCapacityKw,
        config.panelTilt,
        config.panelAzimuth,
        config.latitude,
        config.longitude,
      ]
    );

    return new Response(JSON.stringify({ message: 'Configuration updated successfully' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error updating solar config:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
