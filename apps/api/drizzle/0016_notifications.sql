CREATE TABLE `notification_log` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`unique_key` varchar(190) character set ascii collate ascii_bin NOT NULL,
	`template` varchar(40) character set ascii collate ascii_bin NOT NULL,
	`channel` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`audience` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin,
	`recipient` varchar(254) NOT NULL,
	`locale` varchar(5) character set ascii collate ascii_bin NOT NULL,
	`body` text NOT NULL,
	`status` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`provider` varchar(24) character set ascii collate ascii_bin,
	`provider_ref` varchar(120),
	`error` varchar(300),
	`created_at` datetime(3) NOT NULL,
	`sent_at` datetime(3),
	CONSTRAINT `notification_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_log_key_uq` UNIQUE(`unique_key`),
	CONSTRAINT `notification_log_channel_chk` CHECK(`notification_log`.`channel` IN ('whatsapp', 'sms', 'email')),
	CONSTRAINT `notification_log_status_chk` CHECK(`notification_log`.`status` IN ('queued', 'sent', 'failed', 'skipped')),
	CONSTRAINT `notification_log_audience_chk` CHECK(`notification_log`.`audience` IN ('customer', 'staff'))
);
--> statement-breakpoint
ALTER TABLE `notification_log` ADD CONSTRAINT `notification_log_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notification_log_order_idx` ON `notification_log` (`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_log_status_idx` ON `notification_log` (`status`,`created_at`);