CREATE TABLE `trash_items` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`kind` enum('product','category','attribute','collection','promo','page') NOT NULL,
	`label` varchar(160) NOT NULL,
	`payload` json NOT NULL,
	`deleted_at` datetime(3) NOT NULL,
	`deleted_by_id` char(36) character set ascii collate ascii_bin,
	`deleted_by_name` varchar(100),
	`expires_at` datetime(3) NOT NULL,
	`restored_at` datetime(3),
	CONSTRAINT `trash_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `trash_items_open_idx` ON `trash_items` (`restored_at`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `trash_items_expires_idx` ON `trash_items` (`expires_at`);