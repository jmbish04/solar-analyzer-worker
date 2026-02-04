import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// PGE Usage data table
export const pgeUsage = sqliteTable('pge_usage', {
  date: text('date').notNull(),
  hour: text('hour').notNull(),
  usage: real('usage'),
  units: text('units'),
}, (table) => [
  primaryKey({ columns: [table.date, table.hour] }),
]);

// Solar test data table
export const solarTest = sqliteTable('solar_test', {
  date: text('date').primaryKey(),
  value: real('value'),
  notes: text('notes'),
});

// PVWatts daily data table
export const pvwatts = sqliteTable('pvwatts', {
  date: text('date').primaryKey(),
  acWh: real('ac_wh'),
  dcKw: real('dc_kw'),
  ghi: real('ghi'),
  dni: real('dni'),
  dhi: real('dhi'),
});

// PVWatts hourly data table
export const pvwattsHourly = sqliteTable('pvwatts_hourly', {
  date: text('date').notNull(),
  hour: text('hour').notNull(),
  acWh: real('ac_wh'),
}, (table) => [
  primaryKey({ columns: [table.date, table.hour] }),
]);

// PVWatts hourly expected data table
export const pvwattsHourlyExpected = sqliteTable('pvwatts_hourly_expected', {
  date: text('date').notNull(),
  hour: text('hour').notNull(),
  acWh: real('ac_wh'),
}, (table) => [
  primaryKey({ columns: [table.date, table.hour] }),
]);

// Sunrise/Sunset data table
export const sunriseSunset = sqliteTable('sunrise_sunset', {
  date: text('date').primaryKey(),
  sunrise: text('sunrise'),
  sunset: text('sunset'),
  sunHours: real('sun_hours'),
});

// PGE rates table
export const pgeRates = sqliteTable('pge_rates', {
  effectiveDate: text('effective_date').primaryKey(),
  expirationDate: text('expiration_date').notNull(),
  sourceUrl: text('source_url'),
  ratesJson: text('rates_json').notNull(),
});

// Solar configuration table
export const solarConfig = sqliteTable('solar_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  panelCount: integer('panel_count'),
  panelOutputWatts: integer('panel_output_watts'),
  systemCapacityKw: real('system_capacity_kw').notNull(),
  panelTilt: real('panel_tilt').notNull(),
  panelAzimuth: real('panel_azimuth').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  timestamp: text('timestamp').default('CURRENT_TIMESTAMP'),
});

// Type exports for use in handlers
export type PgeUsage = typeof pgeUsage.$inferSelect;
export type InsertPgeUsage = typeof pgeUsage.$inferInsert;

export type SolarTest = typeof solarTest.$inferSelect;
export type InsertSolarTest = typeof solarTest.$inferInsert;

export type Pvwatts = typeof pvwatts.$inferSelect;
export type InsertPvwatts = typeof pvwatts.$inferInsert;

export type PvwattsHourly = typeof pvwattsHourly.$inferSelect;
export type InsertPvwattsHourly = typeof pvwattsHourly.$inferInsert;

export type PvwattsHourlyExpected = typeof pvwattsHourlyExpected.$inferSelect;
export type InsertPvwattsHourlyExpected = typeof pvwattsHourlyExpected.$inferInsert;

export type SunriseSunset = typeof sunriseSunset.$inferSelect;
export type InsertSunriseSunset = typeof sunriseSunset.$inferInsert;

export type PgeRates = typeof pgeRates.$inferSelect;
export type InsertPgeRates = typeof pgeRates.$inferInsert;

export type SolarConfig = typeof solarConfig.$inferSelect;
export type InsertSolarConfig = typeof solarConfig.$inferInsert;
