import openapi from '../public/openapi.json';
import { handleUploadPgeUsage } from './services/usageUpload';
import { handleUploadSolarTest } from './services/solarTestUpload';
import { handleBackfillPvwatts } from './services/pvwattsBackfill';
import { handleBackfillSunrise } from './services/sunriseBackfill';
import { handleNemAnalysis } from './services/nemAnalysis';
import { handleRefreshPgeRates, handleGetPgeRates, handleUpdatePgeRates } from './services/pgeRates';
// Assuming these handlers exist from previous state, will keep them.
import { handleDailySummary } from './services/dailySummary';
import { handleLossAnalysis } from './services/lossAnalysis';
import { handleNem3Model } from './services/nem3Modeling';
import { handleGetSolarConfig, handleUpdateSolarConfig } from './services/solarConfig';
import { handleDataStatus } from './services/dataStatus';


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    

    // Serve OpenAPI spec
    if (request.method === 'GET' && pathname === '/openapi.json') {
      return new Response(JSON.stringify(openapi), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // Allow CORS for spec visibility
        },
      });
    }

    // Config
    if (request.method === 'GET' && pathname === '/config') {
      return handleGetSolarConfig(request, env);
    }
    if (request.method === 'POST' && pathname === '/config') {
      return handleUpdateSolarConfig(request, env);
    }

    // Data Status
    if (request.method === 'GET' && pathname.startsWith('/data-status/')) {
      return handleDataStatus(request, env);
    }

    // Data Uploads
    if (request.method === 'POST' && pathname === '/upload/pge_usage') {
      return handleUploadPgeUsage(request, env);
    }
    if (request.method === 'POST' && pathname === '/upload/solar_test') {
      return handleUploadSolarTest(request, env);
    }

    // Data Backfills
    if (request.method === 'POST' && pathname.startsWith('/backfill/pvwatts')) {
      return handleBackfillPvwatts(request, env);
    }
    if (request.method === 'POST' && pathname.startsWith('/backfill/sunrise_sunset')) {
      return handleBackfillSunrise(request, env);
    }

    // Analysis Endpoints
    if (request.method === 'GET' && pathname.startsWith('/analysis/nem2vnem3')) {
      return handleNemAnalysis(request, env);
    }
    if (request.method === 'GET' && pathname.startsWith('/analysis/daily-summary')) {
      return handleDailySummary(request, env);
    }
    if (request.method === 'GET' && pathname.startsWith('/analysis/loss')) {
      return handleLossAnalysis(request, env);
    }
    if (request.method === 'POST' && pathname.startsWith('/analysis/nem3_model')) {
      return handleNem3Model(request, env);
    }

    // PGE Rate Management
    if (request.method === 'POST' && pathname === '/refresh/pge-rates') {
      return handleRefreshPgeRates(request, env);
    }
    if (request.method === 'POST' && pathname === '/refresh/other-data') {
      return new Response('Not Implemented', { status: 501 });
    }
    if (request.method === 'GET' && pathname === '/rates/pge') {
      return handleGetPgeRates(request, env);
    }
    if (request.method === 'POST' && pathname === '/rates/pge') {
      return handleUpdatePgeRates(request, env);
    }

    return new Response('Not Found', { status: 404 });
  }
} satisfies ExportedHandler<Env>;
