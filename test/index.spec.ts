import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src';

const CSV = `TYPE,DATE,START TIME,END TIME,USAGE (kWh)
Electric usage,2023-01-01,00:00,00:59,1.2`;

describe('solar analyzer worker', () => {
  beforeAll(async () => {
    env.PVWATTS_API_KEY = 'DEMO_KEY';
    const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS pge_usage (
  date TEXT,
  hour TEXT,
  usage REAL,
  units TEXT,
  PRIMARY KEY(date, hour)
);
CREATE TABLE IF NOT EXISTS solar_test (
  date TEXT PRIMARY KEY,
  value REAL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS pvwatts (
  date TEXT PRIMARY KEY,
  ac_wh REAL,
  dc_kw REAL,
  ghi REAL,
  dni REAL,
  dhi REAL
);
CREATE TABLE IF NOT EXISTS pvwatts_hourly (
  date TEXT,
  hour TEXT,
  ac_wh REAL,
  PRIMARY KEY(date, hour)
);
CREATE TABLE IF NOT EXISTS sunrise_sunset (
  date TEXT PRIMARY KEY,
  sunrise TEXT,
  sunset TEXT,
  sun_hours REAL
);`;
    for (const stmt of SCHEMA_SQL.split(';')) {
      const sql = stmt.trim();
      if (sql) {
        await env.DB.prepare(sql).run();
      }
    }
  });

  it('uploads pge usage', async () => {
    const request = new Request('http://example.com/api/upload/pge_usage', { method: 'POST', body: CSV });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const data = await env.DB.prepare('SELECT count(*) as c FROM pge_usage').first<any>();
    expect(data.c).toBeGreaterThanOrEqual(1);
  });

  it('serves openapi spec', async () => {
    const request = new Request('http://example.com/api/openapi.json');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.openapi).toBe('3.1.0');
    expect(data.info.title).toBe('Solar Analyzer API');
  });

  it('serves swagger ui', async () => {
    const request = new Request('http://example.com/swagger');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Solar Analyzer API');
  });

  it('returns 500 when OPENAI_API_KEY not configured for nem analysis', async () => {
    await env.DB.prepare('INSERT OR REPLACE INTO pge_usage (date, hour, usage, units) VALUES ("2023-01-01", "00", 1, "kWh")').run();
    await env.DB.prepare('INSERT OR REPLACE INTO pvwatts_hourly (date, hour, ac_wh) VALUES ("2023-01-01", "00", 0.5)').run();
    const request = new Request('http://example.com/api/analysis/nem2vnem3?start=2023-01-01&end=2023-01-01');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    // Should return 500 because OPENAI_API_KEY is not set
    expect(response.status).toBe(500);
  });

  it('gets data status for pvwatts', async () => {
    const request = new Request('http://example.com/api/data-status/pvwatts');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.dataType).toBe('pvwatts');
  });
});
