CREATE TABLE `media` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`kind` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'image',
	`status` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'pending',
	`object_key` varchar(500) character set ascii collate ascii_bin NOT NULL,
	`content_type` varchar(60) character set ascii collate ascii_bin NOT NULL,
	`bytes` int NOT NULL,
	`width` int,
	`height` int,
	`lqip` varchar(1500),
	`duration_sec` int,
	`poster_media_id` char(36) character set ascii collate ascii_bin,
	`alt` varchar(300) NOT NULL DEFAULT '',
	`i18n` json,
	`reject_reason` varchar(100),
	`uploaded_by` char(36) character set ascii collate ascii_bin,
	`confirmed_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_object_key_uq` UNIQUE(`object_key`),
	CONSTRAINT `media_kind_chk` CHECK(`media`.`kind` IN ('image', 'video')),
	CONSTRAINT `media_status_chk` CHECK(`media`.`status` IN ('pending', 'ready', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_poster_fk` FOREIGN KEY (`poster_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_uploaded_by_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_status_idx` ON `media` (`status`,`created_at`);