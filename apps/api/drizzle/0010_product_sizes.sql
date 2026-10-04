CREATE TABLE `product_sizes` (
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`size_system_value_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`in_stock` boolean NOT NULL,
	CONSTRAINT `product_sizes_product_id_size_system_value_id_pk` PRIMARY KEY(`product_id`,`size_system_value_id`)
);
--> statement-breakpoint
ALTER TABLE `product_sizes` ADD CONSTRAINT `ps_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_sizes` ADD CONSTRAINT `ps_size_fk` FOREIGN KEY (`size_system_value_id`) REFERENCES `size_system_values`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `product_sizes_value_idx` ON `product_sizes` (`size_system_value_id`,`in_stock`,`product_id`);
--> statement-breakpoint
INSERT INTO `product_sizes` (`product_id`, `size_system_value_id`, `in_stock`)
SELECT v.`product_id`, pov.`size_system_value_id`,
  MAX(v.`stock_mode` <> 'counted' OR EXISTS (SELECT 1 FROM `inventory_levels` il WHERE il.`variant_id` = v.`id` AND il.`on_hand` - il.`reserved` > 0))
FROM `variants` v
JOIN `variant_option_values` vov ON vov.`variant_id` = v.`id`
JOIN `product_option_values` pov ON pov.`id` = vov.`option_value_id`
WHERE v.`enabled` = 1 AND pov.`size_system_value_id` IS NOT NULL
GROUP BY v.`product_id`, pov.`size_system_value_id`;
