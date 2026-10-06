CREATE TABLE `cart_lines` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`cart_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`variant_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`quantity` smallint NOT NULL,
	`customization` json,
	`customization_hash` char(64) character set ascii collate ascii_bin NOT NULL DEFAULT '',
	`seen_unit_price_minor` bigint NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `cart_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_lines_identity_uq` UNIQUE(`cart_id`,`variant_id`,`customization_hash`),
	CONSTRAINT `cart_lines_quantity_chk` CHECK(`cart_lines`.`quantity` between 1 and 99)
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`token_hash` char(64) character set ascii collate ascii_bin NOT NULL,
	`promo_id` char(36) character set ascii collate ascii_bin,
	`locale` varchar(5) character set ascii collate ascii_bin NOT NULL DEFAULT 'en',
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `carts_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `cart_lines` ADD CONSTRAINT `cart_lines_cart_fk` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_lines` ADD CONSTRAINT `cart_lines_variant_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carts` ADD CONSTRAINT `carts_promo_fk` FOREIGN KEY (`promo_id`) REFERENCES `promos`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cart_lines_cart_idx` ON `cart_lines` (`cart_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `carts_updated_idx` ON `carts` (`updated_at`);