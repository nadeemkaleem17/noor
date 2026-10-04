CREATE TABLE `cities` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(60) NOT NULL,
	`province` varchar(40) NOT NULL,
	`aliases` json,
	`is_major` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `cities_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `couriers` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(60) NOT NULL,
	`tracking_url_pattern` varchar(300),
	`tracking_required` boolean NOT NULL DEFAULT true,
	`enabled` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `couriers_id` PRIMARY KEY(`id`),
	CONSTRAINT `couriers_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `shipping_methods` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`zone_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`label` varchar(60) NOT NULL,
	`fee_minor` bigint NOT NULL,
	`free_above_minor` bigint,
	`eta_min_days` smallint NOT NULL,
	`eta_max_days` smallint NOT NULL,
	`cod_allowed` boolean NOT NULL DEFAULT true,
	`enabled` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`i18n` json,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `shipping_methods_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipping_methods_fee_chk` CHECK(`shipping_methods`.`fee_minor` >= 0),
	CONSTRAINT `shipping_methods_free_chk` CHECK(`shipping_methods`.`free_above_minor` is null or `shipping_methods`.`free_above_minor` >= 0),
	CONSTRAINT `shipping_methods_eta_chk` CHECK(`shipping_methods`.`eta_min_days` >= 0 and `shipping_methods`.`eta_min_days` <= `shipping_methods`.`eta_max_days` and `shipping_methods`.`eta_max_days` <= 60)
);
--> statement-breakpoint
CREATE TABLE `shipping_zone_cities` (
	`city_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`zone_id` char(36) character set ascii collate ascii_bin NOT NULL,
	CONSTRAINT `shipping_zone_cities_city_id_pk` PRIMARY KEY(`city_id`)
);
--> statement-breakpoint
CREATE TABLE `shipping_zones` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(60) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `shipping_zones_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipping_zones_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `shipping_methods` ADD CONSTRAINT `shipping_methods_zone_fk` FOREIGN KEY (`zone_id`) REFERENCES `shipping_zones`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipping_zone_cities` ADD CONSTRAINT `szc_city_fk` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipping_zone_cities` ADD CONSTRAINT `szc_zone_fk` FOREIGN KEY (`zone_id`) REFERENCES `shipping_zones`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `shipping_methods_zone_idx` ON `shipping_methods` (`zone_id`,`enabled`,`sort_order`);--> statement-breakpoint
CREATE INDEX `shipping_zone_cities_zone_idx` ON `shipping_zone_cities` (`zone_id`);