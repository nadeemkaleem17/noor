CREATE TABLE `account_orders` (
	`order_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`customer_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`via` enum('placed','claimed') NOT NULL,
	`linked_at` datetime(3) NOT NULL,
	CONSTRAINT `account_orders_order_id` PRIMARY KEY(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `customer_accounts` (
	`customer_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`registered_at` datetime(3) NOT NULL,
	`last_login_at` datetime(3),
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `customer_accounts_customer_id` PRIMARY KEY(`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `customer_sessions` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`customer_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`token_hash` char(64) character set ascii collate ascii_bin NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `customer_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_sessions_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `account_orders` ADD CONSTRAINT `account_orders_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account_orders` ADD CONSTRAINT `account_orders_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_accounts` ADD CONSTRAINT `customer_accounts_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_sessions` ADD CONSTRAINT `customer_sessions_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_orders_customer_idx` ON `account_orders` (`customer_id`,`linked_at`);--> statement-breakpoint
CREATE INDEX `customer_sessions_customer_idx` ON `customer_sessions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `customer_sessions_expires_idx` ON `customer_sessions` (`expires_at`);