CREATE TABLE `counters` (
	`name` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`value` bigint NOT NULL,
	CONSTRAINT `counters_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`scope` varchar(40) character set ascii collate ascii_bin NOT NULL,
	`key` char(36) character set ascii collate ascii_bin NOT NULL,
	`request_hash` char(64) character set ascii collate ascii_bin NOT NULL,
	`status` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`response_status` smallint,
	`response_body` json,
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `idempotency_keys_scope_key_pk` PRIMARY KEY(`scope`,`key`),
	CONSTRAINT `idempotency_keys_status_chk` CHECK(`idempotency_keys`.`status` IN ('in_progress', 'done'))
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
CREATE TABLE `rate_limit_hits` (
	`bucket` varchar(24) character set ascii collate ascii_bin NOT NULL,
	`subject` varchar(100) character set ascii collate ascii_bin NOT NULL,
	`window_start` datetime(3) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	CONSTRAINT `rate_limit_hits_bucket_subject_window_start_pk` PRIMARY KEY(`bucket`,`subject`,`window_start`)
);
--> statement-breakpoint
CREATE INDEX `idempotency_keys_expires_idx` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE INDEX `jobs_claim_idx` ON `jobs` (`run_at`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE INDEX `jobs_dead_type_idx` ON `jobs_dead` (`type`,`died_at`);--> statement-breakpoint
CREATE INDEX `outbox_events_unprocessed_idx` ON `outbox_events` (`processed_at`,`id`);--> statement-breakpoint
CREATE INDEX `rate_limit_hits_window_idx` ON `rate_limit_hits` (`window_start`);