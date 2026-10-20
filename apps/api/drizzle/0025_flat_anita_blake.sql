CREATE TABLE `delivery_assignments` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`run_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`status` enum('assigned','out','delivered','failed','returned','removed') NOT NULL DEFAULT 'assigned',
	`cash_due_minor` bigint NOT NULL,
	`collected_minor` bigint NOT NULL DEFAULT 0,
	`fail_reason` varchar(200),
	`open_key` char(36) character set ascii collate ascii_bin,
	`assigned_at` datetime(3) NOT NULL,
	`out_at` datetime(3),
	`resolved_at` datetime(3),
	CONSTRAINT `delivery_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_assignments_open_uq` UNIQUE(`open_key`)
);
--> statement-breakpoint
CREATE TABLE `delivery_people` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(80) NOT NULL,
	`phone` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`kind` enum('employee','freelancer','courier_rider') NOT NULL,
	`courier_id` char(36) character set ascii collate ascii_bin,
	`fee_minor` bigint NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`note` varchar(300),
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `delivery_people_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_runs` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`number` int NOT NULL,
	`person_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`run_date` date NOT NULL,
	`status` enum('open','out','closed') NOT NULL DEFAULT 'open',
	`note` varchar(300),
	`created_by` char(36) character set ascii collate ascii_bin,
	`out_at` datetime(3),
	`closed_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `delivery_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_runs_number_uq` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`number` varchar(12) character set ascii collate ascii_bin NOT NULL,
	`kind` enum('customer','deposit','fee') NOT NULL,
	`person_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin,
	`amount_minor` bigint NOT NULL,
	`status` enum('issued','void') NOT NULL DEFAULT 'issued',
	`void_reason` varchar(200),
	`issued_by` char(36) character set ascii collate ascii_bin,
	`issued_at` datetime(3) NOT NULL,
	`voided_by` char(36) character set ascii collate ascii_bin,
	`voided_at` datetime(3),
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipts_number_uq` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `rider_ledger` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`person_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`kind` enum('cash_due','cash_returned','deposit','fee','fee_paid','adjustment','reversal') NOT NULL,
	`amount_minor` bigint NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin,
	`assignment_id` char(36) character set ascii collate ascii_bin,
	`run_id` char(36) character set ascii collate ascii_bin,
	`receipt_id` char(36) character set ascii collate ascii_bin,
	`reverses_id` char(36) character set ascii collate ascii_bin,
	`note` varchar(300),
	`actor_id` char(36) character set ascii collate ascii_bin,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `rider_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `delivery_assignments` ADD CONSTRAINT `delivery_assignments_run_fk` FOREIGN KEY (`run_id`) REFERENCES `delivery_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_assignments` ADD CONSTRAINT `delivery_assignments_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_people` ADD CONSTRAINT `delivery_people_courier_fk` FOREIGN KEY (`courier_id`) REFERENCES `couriers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_runs` ADD CONSTRAINT `delivery_runs_person_fk` FOREIGN KEY (`person_id`) REFERENCES `delivery_people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_person_fk` FOREIGN KEY (`person_id`) REFERENCES `delivery_people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rider_ledger` ADD CONSTRAINT `rider_ledger_person_fk` FOREIGN KEY (`person_id`) REFERENCES `delivery_people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `delivery_assignments_run_idx` ON `delivery_assignments` (`run_id`);--> statement-breakpoint
CREATE INDEX `delivery_assignments_order_idx` ON `delivery_assignments` (`order_id`,`assigned_at`);--> statement-breakpoint
CREATE INDEX `delivery_people_active_idx` ON `delivery_people` (`active`,`name`);--> statement-breakpoint
CREATE INDEX `delivery_runs_person_idx` ON `delivery_runs` (`person_id`,`run_date`);--> statement-breakpoint
CREATE INDEX `delivery_runs_status_idx` ON `delivery_runs` (`status`,`run_date`);--> statement-breakpoint
CREATE INDEX `receipts_person_idx` ON `receipts` (`person_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `receipts_order_idx` ON `receipts` (`order_id`);--> statement-breakpoint
CREATE INDEX `rider_ledger_person_idx` ON `rider_ledger` (`person_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `rider_ledger_order_idx` ON `rider_ledger` (`order_id`);--> statement-breakpoint
CREATE INDEX `rider_ledger_run_idx` ON `rider_ledger` (`run_id`);