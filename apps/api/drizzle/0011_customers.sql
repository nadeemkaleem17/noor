CREATE TABLE `customer_notes` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`customer_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`body` varchar(1000) NOT NULL,
	`staff_user_id` char(36) character set ascii collate ascii_bin,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `customer_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`phone` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(80) NOT NULL,
	`email` varchar(254),
	`city` varchar(60),
	`no_cod` boolean NOT NULL DEFAULT false,
	`no_cod_reason` varchar(300),
	`vip` boolean NOT NULL DEFAULT false,
	`marketing_consent` boolean NOT NULL DEFAULT false,
	`consent_note` varchar(200),
	`orders_count` int NOT NULL DEFAULT 0,
	`delivered_count` int NOT NULL DEFAULT 0,
	`refused_count` int NOT NULL DEFAULT 0,
	`cancelled_count` int NOT NULL DEFAULT 0,
	`spent_minor` bigint NOT NULL DEFAULT 0,
	`first_order_at` datetime(3),
	`last_order_at` datetime(3),
	`anonymised_at` datetime(3),
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_phone_uq` UNIQUE(`phone`)
);
--> statement-breakpoint
ALTER TABLE `customer_notes` ADD CONSTRAINT `customer_notes_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_notes` ADD CONSTRAINT `customer_notes_staff_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_notes_customer_idx` ON `customer_notes` (`customer_id`);--> statement-breakpoint
CREATE INDEX `customers_last_order_idx` ON `customers` (`last_order_at`);--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE INDEX `customers_city_idx` ON `customers` (`city`);--> statement-breakpoint
CREATE INDEX `customers_refused_idx` ON `customers` (`refused_count`);