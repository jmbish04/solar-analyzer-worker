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
    const request = new Request('http://example.com/upload/pge_usage', { method: 'POST', body: CSV });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const data = await env.DB.prepare('SELECT count(*) as c FROM pge_usage').first<any>();
    expect(data.c).toBe(1);
  });

  it('calculates nem diff', async () => {
    await env.DB.prepare('INSERT INTO pge_usage (date, hour, usage, units) VALUES ("2023-01-01", "00", 1, "kWh")').run();
    await env.DB.prepare('INSERT INTO pvwatts_hourly (date, hour, ac_wh) VALUES ("2023-01-01", "00", 0.5)').run();
    const request = new Request('http://example.com/analysis/nem2vnem3?start=2023-01-01&end=2023-01-01');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.costNEM2).toBeCloseTo(0.5 * 0.25);
    expect(data.costNEM3).toBeCloseTo(0.5 * 0.25);
    expect(data.diff).toBeCloseTo(0);
  });

  it('calculates diff for net generation', async () => {
    await env.DB.prepare('INSERT INTO pge_usage (date, hour, usage, units) VALUES ("2023-01-02", "00", 0.5, "kWh")').run();
    await env.DB.prepare('INSERT INTO pvwatts_hourly (date, hour, ac_wh) VALUES ("2023-01-02", "00", 1.0)').run();
    const request = new Request('http://example.com/analysis/nem2vnem3?start=2023-01-02&end=2023-01-02');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const data = await response.json();
    const rate = 0.25;
    expect(data.costNEM2).toBeCloseTo(-0.5 * rate);
    expect(data.costNEM3).toBeCloseTo(-0.5 * rate * 0.75);
    expect(data.diff).toBeCloseTo(0.5 * rate * 0.25);
  });
});
