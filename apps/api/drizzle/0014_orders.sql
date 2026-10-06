CREATE TABLE `order_events` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`type` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`from_status` varchar(24) character set ascii collate ascii_bin,
	`to_status` varchar(24) character set ascii collate ascii_bin,
	`actor_type` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`actor_id` char(36) character set ascii collate ascii_bin,
	`actor_label` varchar(120),
	`data` json,
	`public` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_events_actor_chk` CHECK(`order_events`.`actor_type` IN ('staff', 'system', 'storefront'))
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`position` smallint NOT NULL,
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`variant_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`kind` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`title` varchar(120) NOT NULL,
	`variant_label` varchar(120) NOT NULL DEFAULT '',
	`sku` varchar(40) character set ascii collate ascii_bin NOT NULL,
	`image_media_id` char(36) character set ascii collate ascii_bin,
	`quantity` smallint NOT NULL,
	`unit_price_minor` bigint NOT NULL,
	`line_subtotal_minor` bigint NOT NULL,
	`discount_minor` bigint NOT NULL DEFAULT 0,
	`deposit_minor` bigint NOT NULL DEFAULT 0,
	`customization` json,
	`stock_tracked` boolean NOT NULL,
	`returned_quantity` smallint NOT NULL DEFAULT 0,
	`lead_min_days` smallint,
	`lead_max_days` smallint,
	CONSTRAINT `order_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_lines_quantity_chk` CHECK(`order_lines`.`quantity` > 0),
	CONSTRAINT `order_lines_subtotal_chk` CHECK(`order_lines`.`line_subtotal_minor` = `order_lines`.`unit_price_minor` * `order_lines`.`quantity`),
	CONSTRAINT `order_lines_returned_chk` CHECK(`order_lines`.`returned_quantity` <= `order_lines`.`quantity`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`number` bigint NOT NULL,
	`number_prefix` varchar(4) character set ascii collate ascii_bin NOT NULL,
	`tracking_token_hash` char(64) character set ascii collate ascii_bin NOT NULL,
	`status` varchar(24) character set ascii collate ascii_bin NOT NULL,
	`channel` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'storefront',
	`locale` varchar(5) character set ascii collate ascii_bin NOT NULL DEFAULT 'en',
	`customer_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`customer_name` varchar(80) NOT NULL,
	`customer_phone` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`customer_email` varchar(254),
	`ship_city_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`ship_city` varchar(60) NOT NULL,
	`ship_address` varchar(250) NOT NULL,
	`ship_landmark` varchar(120),
	`ship_notes` varchar(250),
	`custom_fields` json,
	`shipping_method_id` char(36) character set ascii collate ascii_bin,
	`shipping_method_label` varchar(60) NOT NULL,
	`eta_min_days` smallint NOT NULL,
	`eta_max_days` smallint NOT NULL,
	`subtotal_minor` bigint NOT NULL,
	`discount_minor` bigint NOT NULL DEFAULT 0,
	`shipping_fee_minor` bigint NOT NULL,
	`total_minor` bigint NOT NULL,
	`deposit_due_minor` bigint NOT NULL DEFAULT 0,
	`paid_minor` bigint NOT NULL DEFAULT 0,
	`refunded_minor` bigint NOT NULL DEFAULT 0,
	`promo_code` varchar(20) character set ascii collate ascii_bin,
	`payment_method` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`payment_status` varchar(24) character set ascii collate ascii_bin NOT NULL DEFAULT 'unpaid',
	`invoice_number` varchar(20) character set ascii collate ascii_bin,
	`courier_id` char(36) character set ascii collate ascii_bin,
	`courier_name` varchar(60),
	`tracking_number` varchar(60),
	`cancel_reason` varchar(24) character set ascii collate ascii_bin,
	`placed_at` datetime(3) NOT NULL,
	`confirmed_at` datetime(3),
	`dispatched_at` datetime(3),
	`delivered_at` datetime(3),
	`closed_at` datetime(3),
	`status_changed_at` datetime(3) NOT NULL,
	`created_by` char(36) character set ascii collate ascii_bin,
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_uq` UNIQUE(`number`),
	CONSTRAINT `orders_tracking_token_uq` UNIQUE(`tracking_token_hash`),
	CONSTRAINT `orders_invoice_uq` UNIQUE(`invoice_number`),
	CONSTRAINT `orders_total_chk` CHECK(`orders`.`total_minor` = `orders`.`subtotal_minor` - `orders`.`discount_minor` + `orders`.`shipping_fee_minor`),
	CONSTRAINT `orders_money_chk` CHECK(`orders`.`subtotal_minor` >= 0 and `orders`.`discount_minor` >= 0 and `orders`.`shipping_fee_minor` >= 0 and `orders`.`total_minor` >= 0 and `orders`.`deposit_due_minor` >= 0 and `orders`.`paid_minor` >= 0 and `orders`.`refunded_minor` >= 0 and `orders`.`deposit_due_minor` <= `orders`.`total_minor`),
	CONSTRAINT `orders_status_chk` CHECK(`orders`.`status` IN ('pending', 'pending_confirmation', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'returned')),
	CONSTRAINT `orders_channel_chk` CHECK(`orders`.`channel` IN ('storefront', 'admin')),
	CONSTRAINT `orders_payment_method_chk` CHECK(`orders`.`payment_method` IN ('cod', 'bank_transfer', 'wallet', 'card', 'bnpl')),
	CONSTRAINT `orders_payment_status_chk` CHECK(`orders`.`payment_status` IN ('unpaid', 'deposit_paid', 'paid', 'refund_due', 'partially_refunded', 'refunded'))
);
--> statement-breakpoint
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_lines` ADD CONSTRAINT `order_lines_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_lines` ADD CONSTRAINT `order_lines_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_lines` ADD CONSTRAINT `order_lines_variant_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_lines` ADD CONSTRAINT `order_lines_media_fk` FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_city_fk` FOREIGN KEY (`ship_city_id`) REFERENCES `cities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_method_fk` FOREIGN KEY (`shipping_method_id`) REFERENCES `shipping_methods`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_courier_fk` FOREIGN KEY (`courier_id`) REFERENCES `couriers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`,`id`);--> statement-breakpoint
CREATE INDEX `order_lines_order_idx` ON `order_lines` (`order_id`,`position`);--> statement-breakpoint
CREATE INDEX `order_lines_variant_idx` ON `order_lines` (`variant_id`);--> statement-breakpoint
CREATE INDEX `order_lines_sku_idx` ON `order_lines` (`sku`);--> statement-breakpoint
CREATE INDEX `order_lines_product_idx` ON `order_lines` (`product_id`);--> statement-breakpoint
CREATE INDEX `orders_status_placed_idx` ON `orders` (`status`,`placed_at`);--> statement-breakpoint
CREATE INDEX `orders_status_changed_idx` ON `orders` (`status`,`status_changed_at`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`,`placed_at`);--> statement-breakpoint
CREATE INDEX `orders_phone_idx` ON `orders` (`customer_phone`);--> statement-breakpoint
CREATE INDEX `orders_placed_idx` ON `orders` (`placed_at`);--> statement-breakpoint
CREATE INDEX `orders_city_idx` ON `orders` (`ship_city_id`,`placed_at`);--> statement-breakpoint
CREATE INDEX `orders_tracking_idx` ON `orders` (`tracking_number`);--> statement-breakpoint
CREATE INDEX `orders_promo_idx` ON `orders` (`promo_code`);--> statement-breakpoint
CREATE INDEX `orders_payment_idx` ON `orders` (`payment_method`,`payment_status`);