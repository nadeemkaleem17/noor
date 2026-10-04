CREATE TABLE `counters` (
	`name` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`value` bigint NOT NULL,
	CONSTRAINT `counters_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`type` varchar(64) character set ascii collate ascii_bin NOT NULL,
	`payload` json NOT NULL,
	`unique_key` varchar(190) character set ascii collate ascii_bin,
	`run_at` datetime(3) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 8,
	`locked_at` datetime(3),
	`locked_by` varchar(64),
	`last_error` varchar(500),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_unique_key_uq` UNIQUE(`unique_key`)
);
--> statement-breakpoint
CREATE TABLE `jobs_dead` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`type` varchar(64) character set ascii collate ascii_bin NOT NULL,
	`payload` json NOT NULL,
	`unique_key` varchar(190) character set ascii collate ascii_bin,
	`run_at` datetime(3) NOT NULL,
	`attempts` int NOT NULL,
	`max_attempts` int NOT NULL,
	`last_error` varchar(500),
	`created_at` datetime(3) NOT NULL,
	`died_at` datetime(3) NOT NULL,
	CONSTRAINT `jobs_dead_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`type` varchar(64) character set ascii collate ascii_bin NOT NULL,
	`payload` json NOT NULL,
	`request_id` char(36) character set ascii collate ascii_bin,
	`created_at` datetime(3) NOT NULL,
	`processed_at` datetime(3),
	CONSTRAINT `outbox_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `jobs_claim_idx` ON `jobs` (`locked_at`,`run_at`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE INDEX `jobs_dead_type_idx` ON `jobs_dead` (`type`,`died_at`);--> statement-breakpoint
CREATE INDEX `outbox_events_unprocessed_idx` ON `outbox_events` (`processed_at`,`id`);