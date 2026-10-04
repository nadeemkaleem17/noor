CREATE TABLE `attribute_values` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`attribute_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`code` varchar(40) character set ascii collate ascii_bin NOT NULL,
	`label` varchar(60) NOT NULL,
	`swatch` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`i18n` json,
	CONSTRAINT `attribute_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `attribute_values_code_uq` UNIQUE(`attribute_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `attributes` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`code` varchar(30) character set ascii collate ascii_bin NOT NULL,
	`label` varchar(60) NOT NULL,
	`type` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`display` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`filterable` boolean NOT NULL DEFAULT false,
	`group_label` varchar(60),
	`sort_order` int NOT NULL DEFAULT 0,
	`i18n` json,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `attributes_id` PRIMARY KEY(`id`),
	CONSTRAINT `attributes_code_uq` UNIQUE(`code`),
	CONSTRAINT `attributes_type_chk` CHECK(`attributes`.`type` IN ('enum', 'number', 'boolean', 'color')),
	CONSTRAINT `attributes_display_chk` CHECK(`attributes`.`display` IN ('checkbox', 'swatch', 'buttons', 'range'))
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`parent_id` char(36) character set ascii collate ascii_bin,
	`handle` varchar(80) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(60) NOT NULL,
	`description` varchar(600) NOT NULL DEFAULT '',
	`image_media_id` char(36) character set ascii collate ascii_bin,
	`sort_order` int NOT NULL DEFAULT 0,
	`visible` boolean NOT NULL DEFAULT true,
	`seo_title` varchar(60),
	`seo_description` varchar(160),
	`i18n` json,
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_handle_uq` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE TABLE `category_attributes` (
	`category_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`attribute_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`seo_indexable` boolean NOT NULL DEFAULT false,
	`required` boolean NOT NULL DEFAULT false,
	CONSTRAINT `category_attributes_category_id_attribute_id_pk` PRIMARY KEY(`category_id`,`attribute_id`)
);
--> statement-breakpoint
CREATE TABLE `form_schemas` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`title` varchar(100) NOT NULL,
	`fields` json NOT NULL,
	`allow_notes` boolean NOT NULL DEFAULT false,
	`i18n` json,
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `form_schemas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `handle_redirects` (
	`entity_type` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`old_handle` varchar(80) character set ascii collate ascii_bin NOT NULL,
	`entity_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `handle_redirects_entity_type_old_handle_pk` PRIMARY KEY(`entity_type`,`old_handle`)
);
--> statement-breakpoint
CREATE TABLE `size_charts` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`title` varchar(100) NOT NULL,
	`size_system_id` char(36) character set ascii collate ascii_bin,
	`unit` varchar(2) character set ascii collate ascii_bin NOT NULL,
	`tables` json NOT NULL,
	`guide_media_id` char(36) character set ascii collate ascii_bin,
	`notes` varchar(400),
	`i18n` json,
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `size_charts_id` PRIMARY KEY(`id`),
	CONSTRAINT `size_charts_unit_chk` CHECK(`size_charts`.`unit` IN ('in', 'cm'))
);
--> statement-breakpoint
CREATE TABLE `size_system_values` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`size_system_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`label` varchar(10) NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `size_system_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `size_system_values_label_uq` UNIQUE(`size_system_id`,`label`)
);
--> statement-breakpoint
CREATE TABLE `size_systems` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(60) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `size_systems_id` PRIMARY KEY(`id`),
	CONSTRAINT `size_systems_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `attribute_values` ADD CONSTRAINT `attribute_values_attr_fk` FOREIGN KEY (`attribute_id`) REFERENCES `attributes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_fk` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_image_fk` FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category_attributes` ADD CONSTRAINT `category_attributes_category_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category_attributes` ADD CONSTRAINT `category_attributes_attribute_fk` FOREIGN KEY (`attribute_id`) REFERENCES `attributes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `size_charts` ADD CONSTRAINT `size_charts_system_fk` FOREIGN KEY (`size_system_id`) REFERENCES `size_systems`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `size_charts` ADD CONSTRAINT `size_charts_guide_fk` FOREIGN KEY (`guide_media_id`) REFERENCES `media`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `size_system_values` ADD CONSTRAINT `size_system_values_system_fk` FOREIGN KEY (`size_system_id`) REFERENCES `size_systems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attribute_values_attr_idx` ON `attribute_values` (`attribute_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`,`sort_order`);