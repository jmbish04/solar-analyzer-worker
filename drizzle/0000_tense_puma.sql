CREATE TABLE `pge_rates` (
	`effective_date` text PRIMARY KEY NOT NULL,
	`expiration_date` text NOT NULL,
	`source_url` text,
	`rates_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pge_usage` (
	`date` text NOT NULL,
	`hour` text NOT NULL,
	`usage` real,
	`units` text,
	PRIMARY KEY(`date`, `hour`)
);
--> statement-breakpoint
CREATE TABLE `pvwatts` (
	`date` text PRIMARY KEY NOT NULL,
	`ac_wh` real,
	`dc_kw` real,
	`ghi` real,
	`dni` real,
	`dhi` real
);
--> statement-breakpoint
CREATE TABLE `pvwatts_hourly` (
	`date` text NOT NULL,
	`hour` text NOT NULL,
	`ac_wh` real,
	PRIMARY KEY(`date`, `hour`)
);
--> statement-breakpoint
CREATE TABLE `pvwatts_hourly_expected` (
	`date` text NOT NULL,
	`hour` text NOT NULL,
	`ac_wh` real,
	PRIMARY KEY(`date`, `hour`)
);
--> statement-breakpoint
CREATE TABLE `solar_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`panel_count` integer,
	`panel_output_watts` integer,
	`system_capacity_kw` real NOT NULL,
	`panel_tilt` real NOT NULL,
	`panel_azimuth` real NOT NULL,
	`latitude` real,
	`longitude` real,
	`timestamp` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `solar_test` (
	`date` text PRIMARY KEY NOT NULL,
	`value` real,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `sunrise_sunset` (
	`date` text PRIMARY KEY NOT NULL,
	`sunrise` text,
	`sunset` text,
	`sun_hours` real
);
