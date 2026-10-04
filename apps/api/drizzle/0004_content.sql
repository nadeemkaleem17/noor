CREATE TABLE `menus` (
	`handle` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`items` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updated_at` datetime(3) NOT NULL,
	`updated_by` char(36) character set ascii collate ascii_bin,
	CONSTRAINT `menus_handle` PRIMARY KEY(`handle`)
);
--> statement-breakpoint
CREATE TABLE `page_redirects` (
	`old_slug` varchar(80) character set ascii collate ascii_bin NOT NULL,
	`page_id` char(36) character set ascii collate ascii_bin NOT NULL,
	CONSTRAINT `page_redirects_old_slug` PRIMARY KEY(`old_slug`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`slug` varchar(80) character set ascii collate ascii_bin NOT NULL,
	`title` varchar(100) NOT NULL,
	`body_md` mediumtext NOT NULL,
	`status` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'draft',
	`locked` boolean NOT NULL DEFAULT false,
	`seo_title` varchar(60),
	`seo_description` varchar(160),
	`i18n` json,
	`version` int NOT NULL DEFAULT 1,
	`updated_by` char(36) character set ascii collate ascii_bin,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pages_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `pages_status_chk` CHECK(`pages`.`status` IN ('draft', 'active'))
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`value` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updated_at` datetime(3) NOT NULL,
	`updated_by` char(36) character set ascii collate ascii_bin,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `menus` ADD CONSTRAINT `menus_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page_redirects` ADD CONSTRAINT `page_redirects_page_fk` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pages` ADD CONSTRAINT `pages_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `settings` ADD CONSTRAINT `settings_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;