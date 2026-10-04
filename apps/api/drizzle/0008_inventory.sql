CREATE TABLE `inventory_levels` (
	`variant_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`on_hand` int NOT NULL DEFAULT 0,
	`reserved` int NOT NULL DEFAULT 0,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `inventory_levels_variant_id` PRIMARY KEY(`variant_id`),
	CONSTRAINT `inventory_levels_chk` CHECK(`inventory_levels`.`on_hand` >= 0 and `inventory_levels`.`reserved` >= 0 and `inventory_levels`.`reserved` <= `inventory_levels`.`on_hand`)
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`variant_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`delta` int NOT NULL,
	`reason` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`note` varchar(300),
	`order_id` char(36) character set ascii collate ascii_bin,
	`staff_user_id` char(36) character set ascii collate ascii_bin,
	`on_hand_after` int NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_movements_delta_chk` CHECK(`inventory_movements`.`delta` <> 0),
	CONSTRAINT `inventory_movements_reason_chk` CHECK(`inventory_movements`.`reason` IN ('initial', 'restock', 'correction', 'damaged', 'return_restock', 'return_damaged', 'sale', 'other'))
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_line_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`variant_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`quantity` int NOT NULL,
	`status` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'active',
	`expires_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `reservations_quantity_chk` CHECK(`reservations`.`quantity` > 0),
	CONSTRAINT `reservations_status_chk` CHECK(`reservations`.`status` IN ('active', 'committed', 'released'))
);
--> statement-breakpoint
CREATE TABLE `stock_subscriptions` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`variant_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`phone` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`locale` varchar(5) character set ascii collate ascii_bin NOT NULL DEFAULT 'en',
	`created_at` datetime(3) NOT NULL,
	`notified_at` datetime(3),
	CONSTRAINT `stock_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_subscriptions_variant_phone_uq` UNIQUE(`variant_id`,`phone`)
);
--> statement-breakpoint
ALTER TABLE `inventory_levels` ADD CONSTRAINT `inventory_levels_variant_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_variant_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_staff_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_variant_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_subscriptions` ADD CONSTRAINT `stock_subscriptions_variant_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `inventory_movements_variant_idx` ON `inventory_movements` (`variant_id`,`id`);--> statement-breakpoint
CREATE INDEX `inventory_movements_order_idx` ON `inventory_movements` (`order_id`);--> statement-breakpoint
CREATE INDEX `reservations_order_idx` ON `reservations` (`order_id`);--> statement-breakpoint
CREATE INDEX `reservations_variant_idx` ON `reservations` (`variant_id`,`status`);--> statement-breakpoint
CREATE INDEX `reservations_expiry_idx` ON `reservations` (`status`,`expires_at`);