CREATE TABLE `return_request_lines` (
	`request_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_line_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`quantity` smallint NOT NULL,
	CONSTRAINT `return_request_lines_request_id_order_line_id_pk` PRIMARY KEY(`request_id`,`order_line_id`)
);
--> statement-breakpoint
CREATE TABLE `return_requests` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`number` int NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`kind` enum('return','exchange') NOT NULL,
	`reason` enum('wrong_size','not_as_described','defective','changed_mind','other') NOT NULL,
	`note` varchar(500),
	`exchange_note` varchar(200),
	`status` enum('requested','approved','declined','received','completed') NOT NULL DEFAULT 'requested',
	`decision_note` varchar(300),
	`pickup_on` date,
	`refund_minor` bigint,
	`requested_at` datetime(3) NOT NULL,
	`decided_at` datetime(3),
	`decided_by` char(36) character set ascii collate ascii_bin,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `return_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `return_requests_number_uq` UNIQUE(`number`)
);
--> statement-breakpoint
ALTER TABLE `return_request_lines` ADD CONSTRAINT `return_request_lines_request_fk` FOREIGN KEY (`request_id`) REFERENCES `return_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_request_lines` ADD CONSTRAINT `return_request_lines_line_fk` FOREIGN KEY (`order_line_id`) REFERENCES `order_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_decided_by_fk` FOREIGN KEY (`decided_by`) REFERENCES `staff_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `return_requests_status_idx` ON `return_requests` (`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `return_requests_order_idx` ON `return_requests` (`order_id`);