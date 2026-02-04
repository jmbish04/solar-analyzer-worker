import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { handleUploadPgeUsage } from './services/usageUpload';
import { handleUploadSolarTest } from './services/solarTestUpload';
import { handleBackfillPvwatts } from './services/pvwattsBackfill';
import { handleBackfillSunrise } from './services/sunriseBackfill';
import { handleNemAnalysis } from './services/nemAnalysis';
import { handleRefreshPgeRates, handleGetPgeRates, handleUpdatePgeRates } from './services/pgeRates';
import { handleDailySummary } from './services/dailySummary';
import { handleLossAnalysis } from './services/lossAnalysis';
import { handleNem3Model } from './services/nem3Modeling';
import { handleGetSolarConfig, handleUpdateSolarConfig } from './services/solarConfig';
import { handleDataStatus } from './services/dataStatus';

type Bindings = Env;

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// ============ OpenAPI Schemas ============

const ErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
}).openapi('Error');

const SuccessSchema = z.object({
  success: z.boolean(),
}).openapi('Success');

const InsertedSchema = z.object({
  inserted: z.number(),
}).openapi('InsertedCount');

const DataStatusSchema = z.object({
  dataType: z.string(),
  lastRecordedDate: z.string().nullable(),
}).openapi('DataStatus');

const SolarConfigSchema = z.object({
  panelCount: z.number(),
  panelOutputWatts: z.number(),
  systemCapacityKw: z.number(),
  panelTilt: z.number(),
  panelAzimuth: z.number(),
  latitude: z.number(),
  longitude: z.number(),
}).openapi('SolarConfig');

const NemAnalysisSchema = z.object({
  costNEM2: z.number(),
  costNEM3: z.number(),
  diff: z.number(),
  analysis: z.string().optional(),
  hours: z.array(z.object({
    date: z.string(),
    hour: z.string(),
    usage: z.number(),
    pv: z.number(),
    hourlyDiff: z.number(),
  })),
}).openapi('NemAnalysis');

const Nem3ModelSchema = z.object({
  newSystemCost: z.number(),
  projectedSavings: z.number(),
  analysis: z.string(),
}).openapi('Nem3Model');

const LossAnalysisSchema = z.object({
  totalLoss: z.number(),
  monthlyComparison: z.array(z.object({
    month: z.string(),
    expectedCost: z.number(),
    actualCost: z.number(),
  })),
}).openapi('LossAnalysis');

const DailySummarySchema = z.object({
  date: z.string(),
  summary: z.string(),
  hours: z.array(z.object({
    hour: z.string(),
    usage: z.number(),
    pv: z.number(),
  })),
}).openapi('DailySummary');

const PgeRateSchema = z.object({
  effectiveDate: z.string(),
  expirationDate: z.string(),
  sourceUrl: z.string().nullable(),
  rates: z.object({
    summer: z.object({
      peak: z.number(),
      partialPeak: z.number(),
      offPeak: z.number(),
    }).optional(),
    winter: z.object({
      peak: z.number(),
      partialPeak: z.number(),
      offPeak: z.number(),
    }).optional(),
  }),
}).openapi('PgeRate');

// ============ Routes ============

// Config Routes
const getConfigRoute = createRoute({
  method: 'get',
  path: '/api/config',
  operationId: 'getSolarConfig',
  tags: ['Configuration'],
  summary: 'Get solar configuration',
  description: 'Retrieve the current solar panel configuration',
  responses: {
    200: {
      description: 'Solar configuration',
      content: { 'application/json': { schema: SolarConfigSchema } },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'Configuration not found' },
  },
});

const updateConfigRoute = createRoute({
  method: 'post',
  path: '/api/config',
  operationId: 'updateSolarConfig',
  tags: ['Configuration'],
  summary: 'Update solar configuration',
  description: 'Update the solar panel configuration',
  request: {
    body: { content: { 'application/json': { schema: SolarConfigSchema } } },
  },
  responses: {
    200: { description: 'Configuration updated successfully', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Invalid configuration data' },
    401: { description: 'Unauthorized' },
  },
});

// Data Status Routes
const dataStatusRoute = createRoute({
  method: 'get',
  path: '/api/data-status/{dataType}',
  operationId: 'getDataStatus',
  tags: ['Data Status'],
  summary: 'Get data status',
  description: 'Get the status of data for a specific type (pvwatts or sunrise-sunset)',
  request: {
    params: z.object({
      dataType: z.enum(['pvwatts', 'sunrise-sunset']),
    }),
  },
  responses: {
    200: { description: 'Data status', content: { 'application/json': { schema: DataStatusSchema } } },
    400: { description: 'Invalid data type' },
  },
});

// Upload Routes
const uploadPgeUsageRoute = createRoute({
  method: 'post',
  path: '/api/upload/pge_usage',
  operationId: 'uploadPgeUsage',
  tags: ['Data Upload'],
  summary: 'Upload PGE usage data',
  description: 'Upload PGE electricity usage data from CSV or JSON',
  responses: {
    200: { description: 'Upload successful', content: { 'application/json': { schema: InsertedSchema } } },
  },
});

const uploadSolarTestRoute = createRoute({
  method: 'post',
  path: '/api/upload/solar_test',
  operationId: 'uploadSolarTest',
  tags: ['Data Upload'],
  summary: 'Upload solar test data',
  description: 'Upload solar panel test measurement data',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            date: z.string(),
            value: z.number(),
            notes: z.string().optional(),
          })),
        },
      },
    },
  },
  responses: {
    200: { description: 'Upload successful', content: { 'application/json': { schema: InsertedSchema } } },
  },
});

// Backfill Routes
const backfillPvwattsRoute = createRoute({
  method: 'post',
  path: '/api/backfill/pvwatts',
  operationId: 'backfillPvwatts',
  tags: ['Data Backfill'],
  summary: 'Backfill PVWatts data',
  description: 'Fetch and store PVWatts solar production estimates for a date range',
  request: {
    query: z.object({
      startDate: z.string().openapi({ example: '2024-01-01' }),
      endDate: z.string().openapi({ example: '2024-12-31' }),
      lat: z.string().openapi({ example: '37.7749' }),
      lon: z.string().openapi({ example: '-122.4194' }),
    }),
  },
  responses: {
    200: { description: 'Backfill successful', content: { 'application/json': { schema: InsertedSchema } } },
    400: { description: 'Missing required parameters' },
  },
});

const backfillSunriseRoute = createRoute({
  method: 'post',
  path: '/api/backfill/sunrise_sunset',
  operationId: 'backfillSunriseSunset',
  tags: ['Data Backfill'],
  summary: 'Backfill sunrise/sunset data',
  description: 'Fetch and store sunrise/sunset times for a date range',
  request: {
    query: z.object({
      startDate: z.string().openapi({ example: '2024-01-01' }),
      endDate: z.string().openapi({ example: '2024-12-31' }),
      lat: z.string().openapi({ example: '37.7749' }),
      lon: z.string().openapi({ example: '-122.4194' }),
    }),
  },
  responses: {
    200: { description: 'Backfill successful', content: { 'application/json': { schema: InsertedSchema } } },
    400: { description: 'Missing required parameters' },
  },
});

// Analysis Routes
const nemAnalysisRoute = createRoute({
  method: 'get',
  path: '/api/analysis/nem2vnem3',
  operationId: 'getNemAnalysis',
  tags: ['Analysis'],
  summary: 'Compare NEM 2.0 vs NEM 3.0 costs',
  description: 'Analyze and compare electricity costs under NEM 2.0 and NEM 3.0 for a date range',
  request: {
    query: z.object({
      start: z.string().openapi({ example: '2024-01-01' }),
      end: z.string().openapi({ example: '2024-01-31' }),
    }),
  },
  responses: {
    200: { description: 'NEM analysis results', content: { 'application/json': { schema: NemAnalysisSchema } } },
    400: { description: 'Missing required parameters' },
    500: { description: 'API key not configured' },
  },
});

const dailySummaryRoute = createRoute({
  method: 'get',
  path: '/api/analysis/daily-summary',
  operationId: 'getDailySummary',
  tags: ['Analysis'],
  summary: 'Get daily energy summary',
  description: 'Get an AI-generated summary of energy usage and production for a specific day',
  request: {
    query: z.object({
      date: z.string().openapi({ example: '2024-01-15' }),
    }),
  },
  responses: {
    200: { description: 'Daily summary', content: { 'application/json': { schema: DailySummarySchema } } },
    400: { description: 'Missing date parameter' },
    404: { description: 'No data for this date' },
  },
});

const lossAnalysisRoute = createRoute({
  method: 'get',
  path: '/api/analysis/loss',
  operationId: 'getLossAnalysis',
  tags: ['Analysis'],
  summary: 'Calculate financial losses',
  description: 'Calculate financial losses from solar panel underperformance',
  request: {
    query: z.object({
      start: z.string().openapi({ example: '2024-01-01' }),
      end: z.string().openapi({ example: '2024-12-31' }),
    }),
  },
  responses: {
    200: { description: 'Loss analysis results', content: { 'application/json': { schema: LossAnalysisSchema } } },
    400: { description: 'Missing required parameters' },
  },
});

const nem3ModelRoute = createRoute({
  method: 'post',
  path: '/api/analysis/nem3_model',
  operationId: 'runNem3Model',
  tags: ['Analysis'],
  summary: 'Run NEM 3.0 financial model',
  description: 'Model the financial impact of a new solar + battery system under NEM 3.0',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            systemCapacity: z.number().openapi({ example: 10 }),
            batteryCapacity: z.number().optional().openapi({ example: 13.5 }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Model results', content: { 'application/json': { schema: Nem3ModelSchema } } },
    400: { description: 'Missing system capacity' },
    500: { description: 'API key not configured' },
  },
});

// PGE Rate Routes
const refreshPgeRatesRoute = createRoute({
  method: 'post',
  path: '/api/refresh/pge-rates',
  operationId: 'refreshPgeRates',
  tags: ['PGE Rates'],
  summary: 'Refresh PGE rates from PDF',
  description: 'Scrape and update PGE electricity rates from a PDF document using AI',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Rates refreshed successfully', content: { 'application/json': { schema: SuccessSchema } } },
    500: { description: 'Failed to extract rates' },
  },
});

const getPgeRatesRoute = createRoute({
  method: 'get',
  path: '/api/rates/pge',
  operationId: 'getPgeRates',
  tags: ['PGE Rates'],
  summary: 'Get PGE rates',
  description: 'Retrieve stored PGE electricity rates with optional filtering',
  request: {
    query: z.object({
      year: z.string().optional(),
      season: z.enum(['summer', 'winter']).optional(),
      peakType: z.enum(['peak', 'partialPeak', 'offPeak']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  },
  responses: {
    200: { description: 'PGE rates', content: { 'application/json': { schema: z.array(PgeRateSchema) } } },
  },
});

const updatePgeRatesRoute = createRoute({
  method: 'post',
  path: '/api/rates/pge',
  operationId: 'updatePgeRates',
  tags: ['PGE Rates'],
  summary: 'Update PGE rates manually',
  description: 'Manually insert or update PGE electricity rates',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            effectiveDate: z.string(),
            expirationDate: z.string(),
            sourceUrl: z.string().optional(),
            rates: z.object({
              summer: z.object({
                peak: z.number(),
                partialPeak: z.number(),
                offPeak: z.number(),
              }).optional(),
              winter: z.object({
                peak: z.number(),
                partialPeak: z.number(),
                offPeak: z.number(),
              }).optional(),
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Rates updated successfully', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Missing required fields' },
  },
});

// Register routes with handlers
app.openapi(getConfigRoute, async (c) => {
  const response = await handleGetSolarConfig(c.req.raw, c.env);
  return response as any;
});

app.openapi(updateConfigRoute, async (c) => {
  const response = await handleUpdateSolarConfig(c.req.raw, c.env);
  return response as any;
});

app.openapi(dataStatusRoute, async (c) => {
  const response = await handleDataStatus(c.req.raw, c.env);
  return response as any;
});

app.openapi(uploadPgeUsageRoute, async (c) => {
  const response = await handleUploadPgeUsage(c.req.raw, c.env);
  return response as any;
});

app.openapi(uploadSolarTestRoute, async (c) => {
  const response = await handleUploadSolarTest(c.req.raw, c.env);
  return response as any;
});

app.openapi(backfillPvwattsRoute, async (c) => {
  const response = await handleBackfillPvwatts(c.req.raw, c.env);
  return response as any;
});

app.openapi(backfillSunriseRoute, async (c) => {
  const response = await handleBackfillSunrise(c.req.raw, c.env);
  return response as any;
});

app.openapi(nemAnalysisRoute, async (c) => {
  const response = await handleNemAnalysis(c.req.raw, c.env);
  return response as any;
});

app.openapi(dailySummaryRoute, async (c) => {
  const response = await handleDailySummary(c.req.raw, c.env);
  return response as any;
});

app.openapi(lossAnalysisRoute, async (c) => {
  const response = await handleLossAnalysis(c.req.raw, c.env);
  return response as any;
});

app.openapi(nem3ModelRoute, async (c) => {
  const response = await handleNem3Model(c.req.raw, c.env);
  return response as any;
});

app.openapi(refreshPgeRatesRoute, async (c) => {
  const response = await handleRefreshPgeRates(c.req.raw, c.env);
  return response as any;
});

app.openapi(getPgeRatesRoute, async (c) => {
  const response = await handleGetPgeRates(c.req.raw, c.env);
  return response as any;
});

app.openapi(updatePgeRatesRoute, async (c) => {
  const response = await handleUpdatePgeRates(c.req.raw, c.env);
  return response as any;
});

// Serve OpenAPI spec
app.doc('/api/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Solar Analyzer API',
    version: '1.0.0',
    description: 'API for solar financial analysis, NEM 2.0 vs NEM 3.0 comparison, and energy modeling',
  },
  servers: [
    { url: '/', description: 'Current server' },
  ],
});

// Serve Swagger UI via Scalar
app.get('/swagger', apiReference({
  theme: 'purple',
  spec: { url: '/api/openapi.json' },
  pageTitle: 'Solar Analyzer API',
}));

// Also serve at /api/swagger for consistency
app.get('/api/swagger', apiReference({
  theme: 'purple',
  spec: { url: '/api/openapi.json' },
  pageTitle: 'Solar Analyzer API',
}));

export default app;
