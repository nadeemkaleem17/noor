CREATE TABLE `bundle_items` (
	`bundle_product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`child_product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `bundle_items_bundle_product_id_child_product_id_pk` PRIMARY KEY(`bundle_product_id`,`child_product_id`),
	CONSTRAINT `bundle_items_self_chk` CHECK(`bundle_items`.`bundle_product_id` <> `bundle_items`.`child_product_id`)
);
--> statement-breakpoint
CREATE TABLE `collection_products` (
	`collection_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `collection_products_collection_id_product_id_pk` PRIMARY KEY(`collection_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`handle` varchar(80) character set ascii collate ascii_bin NOT NULL,
	`title` varchar(80) NOT NULL,
	`description` varchar(600) NOT NULL DEFAULT '',
	`image_media_id` char(36) character set ascii collate ascii_bin,
	`status` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'draft',
	`featured` boolean NOT NULL DEFAULT false,
	`starts_at` datetime(3),
	`ends_at` datetime(3),
	`seo_title` varchar(60),
	`seo_description` varchar(160),
	`i18n` json,
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `collections_handle_uq` UNIQUE(`handle`),
	CONSTRAINT `collections_status_chk` CHECK(`collections`.`status` IN ('draft', 'active'))
);
--> statement-breakpoint
CREATE TABLE `product_attribute_values` (
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`attribute_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`value_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`value_number` int,
	CONSTRAINT `product_attribute_values_product_id_attribute_id_value_id_pk` PRIMARY KEY(`product_id`,`attribute_id`,`value_id`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`category_id` char(36) character set ascii collate ascii_bin NOT NULL,
	CONSTRAINT `product_categories_product_id_category_id_pk` PRIMARY KEY(`product_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `product_media` (
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`media_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`sort_order` int NOT NULL,
	`role` varchar(16) character set ascii collate ascii_bin,
	`alt` varchar(300),
	`option_value_id` char(36) character set ascii collate ascii_bin,
	CONSTRAINT `product_media_product_id_media_id_pk` PRIMARY KEY(`product_id`,`media_id`)
);
--> statement-breakpoint
CREATE TABLE `product_option_values` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`option_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`label` varchar(40) NOT NULL,
	`kind` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'standard',
	`size_system_value_id` char(36) character set ascii collate ascii_bin,
	`swatch` json,
	`sort_order` int NOT NULL,
	`i18n` json,
	CONSTRAINT `product_option_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_option_values_label_uq` UNIQUE(`option_id`,`label`),
	CONSTRAINT `product_option_values_kind_chk` CHECK(`product_option_values`.`kind` IN ('standard', 'custom'))
);
--> statement-breakpoint
CREATE TABLE `product_options` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(40) NOT NULL,
	`role` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`display` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'buttons',
	`size_system_id` char(36) character set ascii collate ascii_bin,
	`sort_order` int NOT NULL,
	`i18n` json,
	CONSTRAINT `product_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_options_role_chk` CHECK(`product_options`.`role` IN ('size', 'color', 'material', 'other')),
	CONSTRAINT `product_options_display_chk` CHECK(`product_options`.`display` IN ('buttons', 'swatch', 'select'))
);
--> statement-breakpoint
CREATE TABLE `product_related` (
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`related_product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `product_related_product_id_related_product_id_pk` PRIMARY KEY(`product_id`,`related_product_id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`handle` varchar(80) character set ascii collate ascii_bin NOT NULL,
	`status` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'draft',
	`publish_at` datetime(3),
	`published_at` datetime(3),
	`kind` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`title` varchar(120) NOT NULL,
	`subtitle` varchar(160),
	`brand` varchar(60),
	`description_md` text,
	`highlights` json,
	`care` json,
	`components` json,
	`primary_category_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`style_id` varchar(80) character set ascii collate ascii_bin,
	`colorway_label` varchar(40),
	`color_family` varchar(16) character set ascii collate ascii_bin,
	`colorway_swatch` json,
	`size_chart_id` char(36) character set ascii collate ascii_bin,
	`custom_size_schema_id` char(36) character set ascii collate ascii_bin,
	`fit` json,
	`mto_lead_min_days` smallint,
	`mto_lead_max_days` smallint,
	`mto_lead_label` varchar(80),
	`mto_returnable` boolean,
	`mto_deposit_bps` int,
	`badges` json,
	`seo_title` varchar(60),
	`seo_description` varchar(160),
	`i18n` json,
	`price_min_minor` bigint NOT NULL DEFAULT 0,
	`price_max_minor` bigint NOT NULL DEFAULT 0,
	`compare_at_min_minor` bigint,
	`stock_status` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'sold_out',
	`sales_count` int NOT NULL DEFAULT 0,
	`rating_avg_x100` smallint,
	`rating_count` int NOT NULL DEFAULT 0,
	`featured_rank` int NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_handle_uq` UNIQUE(`handle`),
	CONSTRAINT `products_status_chk` CHECK(`products`.`status` IN ('draft', 'scheduled', 'active', 'archived')),
	CONSTRAINT `products_kind_chk` CHECK(`products`.`kind` IN ('stitched', 'unstitched', 'made_to_order', 'footwear', 'accessory', 'bundle', 'home', 'beauty')),
	CONSTRAINT `products_mto_chk` CHECK(`products`.`mto_lead_min_days` is null or `products`.`mto_lead_min_days` <= `products`.`mto_lead_max_days`),
	CONSTRAINT `products_colorway_chk` CHECK(`products`.`style_id` is null or `products`.`colorway_label` is not null),
	CONSTRAINT `products_price_chk` CHECK(`products`.`price_min_minor` <= `products`.`price_max_minor`)
);
--> statement-breakpoint
CREATE TABLE `variant_option_values` (
	`variant_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`option_value_id` char(36) character set ascii collate ascii_bin NOT NULL,
	CONSTRAINT `variant_option_values_variant_id_option_value_id_pk` PRIMARY KEY(`variant_id`,`option_value_id`)
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`sku` varchar(40) character set ascii collate ascii_bin NOT NULL,
	`option_key` varchar(120) character set ascii collate ascii_bin NOT NULL DEFAULT '',
	`price_minor` bigint NOT NULL,
	`compare_at_minor` bigint,
	`stock_mode` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'counted',
	`preorder_ships_at` date,
	`max_per_order` smallint NOT NULL DEFAULT 10,
	`enabled` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_sku_uq` UNIQUE(`sku`),
	CONSTRAINT `variants_product_option_uq` UNIQUE(`product_id`,`option_key`),
	CONSTRAINT `variants_price_chk` CHECK(`variants`.`price_minor` > 0),
	CONSTRAINT `variants_compare_chk` CHECK(`variants`.`compare_at_minor` is null or `variants`.`compare_at_minor` > `variants`.`price_minor`),
	CONSTRAINT `variants_stock_mode_chk` CHECK(`variants`.`stock_mode` IN ('counted', 'made_to_order', 'preorder')),
	CONSTRAINT `variants_max_chk` CHECK(`variants`.`max_per_order` between 1 and 99)
);
--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_bundle_fk` FOREIGN KEY (`bundle_product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_items` ADD CONSTRAINT `bundle_items_child_fk` FOREIGN KEY (`child_product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collection_products` ADD CONSTRAINT `cp_collection_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collection_products` ADD CONSTRAINT `cp_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collections` ADD CONSTRAINT `collections_image_fk` FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_attribute_values` ADD CONSTRAINT `pav_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_attribute_values` ADD CONSTRAINT `pav_attribute_fk` FOREIGN KEY (`attribute_id`) REFERENCES `attributes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_attribute_values` ADD CONSTRAINT `pav_value_fk` FOREIGN KEY (`value_id`) REFERENCES `attribute_values`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_category_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_media` ADD CONSTRAINT `product_media_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_media` ADD CONSTRAINT `product_media_media_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_media` ADD CONSTRAINT `product_media_option_value_fk` FOREIGN KEY (`option_value_id`) REFERENCES `product_option_values`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_option_values` ADD CONSTRAINT `pov_option_fk` FOREIGN KEY (`option_id`) REFERENCES `product_options`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_option_values` ADD CONSTRAINT `pov_size_value_fk` FOREIGN KEY (`size_system_value_id`) REFERENCES `size_system_values`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_options` ADD CONSTRAINT `product_options_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_options` ADD CONSTRAINT `product_options_size_system_fk` FOREIGN KEY (`size_system_id`) REFERENCES `size_systems`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_related` ADD CONSTRAINT `product_related_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_related` ADD CONSTRAINT `product_related_related_fk` FOREIGN KEY (`related_product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_primary_category_fk` FOREIGN KEY (`primary_category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_size_chart_fk` FOREIGN KEY (`size_chart_id`) REFERENCES `size_charts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_custom_size_fk` FOREIGN KEY (`custom_size_schema_id`) REFERENCES `form_schemas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variant_option_values` ADD CONSTRAINT `vov_variant_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variant_option_values` ADD CONSTRAINT `vov_value_fk` FOREIGN KEY (`option_value_id`) REFERENCES `product_option_values`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variants` ADD CONSTRAINT `variants_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `collection_products_order_idx` ON `collection_products` (`collection_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `collection_products_product_idx` ON `collection_products` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_attribute_values_facet_idx` ON `product_attribute_values` (`attribute_id`,`value_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_categories_category_idx` ON `product_categories` (`category_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_media_order_idx` ON `product_media` (`product_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `product_options_product_idx` ON `product_options` (`product_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `products_status_published_idx` ON `products` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `products_status_price_idx` ON `products` (`status`,`price_min_minor`);--> statement-breakpoint
CREATE INDEX `products_status_sales_idx` ON `products` (`status`,`sales_count`);--> statement-breakpoint
CREATE INDEX `products_primary_category_idx` ON `products` (`primary_category_id`,`status`);--> statement-breakpoint
CREATE INDEX `products_style_idx` ON `products` (`style_id`);--> statement-breakpoint
CREATE INDEX `products_kind_idx` ON `products` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `products_publish_at_idx` ON `products` (`status`,`publish_at`);--> statement-breakpoint
CREATE INDEX `products_updated_idx` ON `products` (`updated_at`);--> statement-breakpoint
CREATE INDEX `variant_option_values_value_idx` ON `variant_option_values` (`option_value_id`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `variants` (`product_id`,`sort_order`);