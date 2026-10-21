CREATE TABLE `access_profiles` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`name` varchar(40) NOT NULL,
	`summary` varchar(200),
	`base_role` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`granted_permissions` json,
	`revoked_permissions` json,
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `access_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `access_profiles_name_uq` UNIQUE(`name`),
	CONSTRAINT `access_profiles_role_chk` CHECK(`access_profiles`.`base_role` IN ('owner', 'manager', 'catalog', 'fulfilment', 'support', 'viewer'))
);
--> statement-breakpoint
ALTER TABLE `staff_users` ADD `profile_id` char(36) character set ascii collate ascii_bin;--> statement-breakpoint
ALTER TABLE `staff_users` ADD CONSTRAINT `staff_users_profile_fk` FOREIGN KEY (`profile_id`) REFERENCES `access_profiles`(`id`) ON DELETE set null ON UPDATE no action;