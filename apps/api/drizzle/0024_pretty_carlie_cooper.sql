CREATE TABLE `customer_highlight_rules` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`kind` enum('orders','visits') NOT NULL,
	`min_count` int NOT NULL,
	`max_count` int,
	`color` varchar(7) NOT NULL,
	`label` varchar(40) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `customer_highlight_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visitors` (
	`id` char(32) character set ascii collate ascii_bin NOT NULL,
	`customer_id` char(36) character set ascii collate ascii_bin,
	`first_seen_at` datetime(3) NOT NULL,
	`last_visit_at` datetime(3) NOT NULL,
	`visits_count` int NOT NULL DEFAULT 1,
	CONSTRAINT `visitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`visitor_id` char(32) character set ascii collate ascii_bin NOT NULL,
	`started_at` datetime(3) NOT NULL,
	`landing_path` varchar(120) NOT NULL,
	CONSTRAINT `visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `visits_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `last_visit_at` datetime(3);--> statement-breakpoint
ALTER TABLE `visitors` ADD CONSTRAINT `visitors_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_visitor_fk` FOREIGN KEY (`visitor_id`) REFERENCES `visitors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_highlight_rules_kind_idx` ON `customer_highlight_rules` (`kind`,`min_count`);--> statement-breakpoint
CREATE INDEX `visitors_customer_idx` ON `visitors` (`customer_id`);--> statement-breakpoint
CREATE INDEX `visitors_first_seen_idx` ON `visitors` (`first_seen_at`);--> statement-breakpoint
CREATE INDEX `visits_visitor_idx` ON `visits` (`visitor_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `visits_started_idx` ON `visits` (`started_at`);--> statement-breakpoint
CREATE INDEX `customers_visits_idx` ON `customers` (`visits_count`);