CREATE TABLE `payment_events` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`provider` varchar(24) character set ascii collate ascii_bin NOT NULL,
	`provider_event_id` varchar(120) character set ascii collate ascii_bin NOT NULL,
	`payment_id` char(36) character set ascii collate ascii_bin,
	`payload` json NOT NULL,
	`received_at` datetime(3) NOT NULL,
	`processed_at` datetime(3),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_events_provider_event_uq` UNIQUE(`provider`,`provider_event_id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`kind` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`method` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`provider` varchar(24) character set ascii collate ascii_bin NOT NULL,
	`state` varchar(24) character set ascii collate ascii_bin NOT NULL,
	`amount_minor` bigint NOT NULL,
	`provider_ref` varchar(120) character set ascii collate ascii_bin,
	`reference` varchar(120),
	`proof_media_id` char(36) character set ascii collate ascii_bin,
	`recorded_by` char(36) character set ascii collate ascii_bin,
	`expires_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_provider_ref_uq` UNIQUE(`provider`,`provider_ref`),
	CONSTRAINT `payments_amount_chk` CHECK(`payments`.`amount_minor` > 0),
	CONSTRAINT `payments_kind_chk` CHECK(`payments`.`kind` IN ('deposit', 'balance', 'full', 'refund')),
	CONSTRAINT `payments_state_chk` CHECK(`payments`.`state` IN ('initiated', 'pending_confirmation', 'authorized', 'captured', 'failed', 'expired', 'refunded'))
);
--> statement-breakpoint
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_payment_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_staff_fk` FOREIGN KEY (`recorded_by`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_proof_fk` FOREIGN KEY (`proof_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_state_idx` ON `payments` (`state`,`created_at`);