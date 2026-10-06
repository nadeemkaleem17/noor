CREATE TABLE `promo_redemptions` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`promo_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`customer_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`discount_minor` bigint NOT NULL,
	`shipping_waived_minor` bigint NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	`reversed_at` datetime(3),
	CONSTRAINT `promo_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_redemptions_order_uq` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `promo_targets` (
	`promo_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`target_type` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`target_id` char(36) character set ascii collate ascii_bin NOT NULL,
	CONSTRAINT `promo_targets_promo_id_target_type_target_id_pk` PRIMARY KEY(`promo_id`,`target_type`,`target_id`),
	CONSTRAINT `promo_targets_type_chk` CHECK(`promo_targets`.`target_type` IN ('category', 'product'))
);
--> statement-breakpoint
CREATE TABLE `promos` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`code` varchar(20) character set ascii collate ascii_bin NOT NULL,
	`type` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`value_bps` int,
	`value_minor` bigint,
	`max_discount_minor` bigint,
	`min_spend_minor` bigint,
	`scope` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'all',
	`exclude_sale_items` boolean NOT NULL DEFAULT true,
	`first_order_only` boolean NOT NULL DEFAULT false,
	`usage_limit` int,
	`per_customer_limit` int DEFAULT 1,
	`usage_count` int NOT NULL DEFAULT 0,
	`starts_at` datetime(3),
	`ends_at` datetime(3),
	`enabled` boolean NOT NULL DEFAULT true,
	`note` varchar(300),
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `promos_id` PRIMARY KEY(`id`),
	CONSTRAINT `promos_code_uq` UNIQUE(`code`),
	CONSTRAINT `promos_type_chk` CHECK(`promos`.`type` IN ('percent', 'fixed', 'free_shipping')),
	CONSTRAINT `promos_scope_chk` CHECK(`promos`.`scope` IN ('all', 'categories', 'products')),
	CONSTRAINT `promos_value_chk` CHECK((`promos`.`type` = 'percent' and `promos`.`value_bps` is not null and `promos`.`value_minor` is null) or (`promos`.`type` = 'fixed' and `promos`.`value_minor` is not null and `promos`.`value_bps` is null) or (`promos`.`type` = 'free_shipping' and `promos`.`value_bps` is null and `promos`.`value_minor` is null))
);
--> statement-breakpoint
ALTER TABLE `promo_redemptions` ADD CONSTRAINT `promo_redemptions_promo_fk` FOREIGN KEY (`promo_id`) REFERENCES `promos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_redemptions` ADD CONSTRAINT `promo_redemptions_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_targets` ADD CONSTRAINT `promo_targets_promo_fk` FOREIGN KEY (`promo_id`) REFERENCES `promos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `promo_redemptions_promo_idx` ON `promo_redemptions` (`promo_id`,`reversed_at`);--> statement-breakpoint
CREATE INDEX `promo_redemptions_customer_idx` ON `promo_redemptions` (`customer_id`,`promo_id`,`reversed_at`);