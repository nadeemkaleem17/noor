CREATE TABLE `audit_log` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`at` datetime(3) NOT NULL,
	`actor_type` varchar(16) character set ascii collate ascii_bin NOT NULL,
	`actor_id` char(36) character set ascii collate ascii_bin,
	`actor_label` varchar(120) NOT NULL,
	`actor_role` varchar(32),
	`action` varchar(64) character set ascii collate ascii_bin NOT NULL,
	`entity_type` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`entity_id` varchar(64) character set ascii collate ascii_bin,
	`entity_label` varchar(200),
	`diff` json,
	`reason` varchar(500),
	`category` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'general',
	`ip` varchar(45),
	`user_agent` varchar(300),
	`request_id` char(36) character set ascii collate ascii_bin,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_log_actor_type_chk` CHECK(`audit_log`.`actor_type` IN ('staff', 'system', 'storefront')),
	CONSTRAINT `audit_log_category_chk` CHECK(`audit_log`.`category` IN ('general', 'security', 'money'))
);
--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`token_hash` char(64) character set ascii collate ascii_bin NOT NULL,
	`type` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`staff_user_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`created_by` char(36) character set ascii collate ascii_bin,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `auth_tokens_token_hash` PRIMARY KEY(`token_hash`),
	CONSTRAINT `auth_tokens_type_chk` CHECK(`auth_tokens`.`type` IN ('invite', 'password_reset'))
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`email_hash` char(64) character set ascii collate ascii_bin NOT NULL,
	`ip` varchar(45) NOT NULL,
	`succeeded` boolean NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recovery_codes` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`staff_user_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`code_hash` varchar(255) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `recovery_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` char(64) character set ascii collate ascii_bin NOT NULL,
	`staff_user_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`kind` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'full',
	`csrf_token` char(43) character set ascii collate ascii_bin NOT NULL,
	`two_factor` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	`last_seen_at` datetime(3) NOT NULL,
	`last_auth_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`ip` varchar(45) NOT NULL,
	`user_agent` varchar(300) NOT NULL,
	CONSTRAINT `sessions_id_hash` PRIMARY KEY(`id_hash`),
	CONSTRAINT `sessions_kind_chk` CHECK(`sessions`.`kind` IN ('pending_2fa', 'enrol_2fa', 'full'))
);
--> statement-breakpoint
CREATE TABLE `staff_users` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`email` varchar(254) NOT NULL,
	`name` varchar(100) NOT NULL,
	`role` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`status` varchar(32) character set ascii collate ascii_bin NOT NULL DEFAULT 'invited',
	`password_hash` varchar(255),
	`totp_secret_enc` varbinary(255),
	`totp_last_step` bigint,
	`totp_enabled_at` datetime(3),
	`lock_count` int NOT NULL DEFAULT 0,
	`locked_until` datetime(3),
	`last_login_at` datetime(3),
	`last_seen_at` datetime(3),
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`created_by` char(36) character set ascii collate ascii_bin,
	CONSTRAINT `staff_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_users_email_uq` UNIQUE(`email`),
	CONSTRAINT `staff_users_role_chk` CHECK(`staff_users`.`role` IN ('owner', 'manager', 'catalog', 'fulfilment', 'support', 'viewer')),
	CONSTRAINT `staff_users_status_chk` CHECK(`staff_users`.`status` IN ('invited', 'active', 'deactivated'))
);
--> statement-breakpoint
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_staff_user_id_staff_users_id_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recovery_codes` ADD CONSTRAINT `recovery_codes_staff_user_id_staff_users_id_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_staff_user_id_staff_users_id_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`,`id`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor_id`,`id`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`,`id`);--> statement-breakpoint
CREATE INDEX `audit_log_category_idx` ON `audit_log` (`category`,`id`);--> statement-breakpoint
CREATE INDEX `audit_log_at_idx` ON `audit_log` (`at`);--> statement-breakpoint
CREATE INDEX `auth_tokens_user_idx` ON `auth_tokens` (`staff_user_id`,`type`);--> statement-breakpoint
CREATE INDEX `login_attempts_email_idx` ON `login_attempts` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `login_attempts_ip_idx` ON `login_attempts` (`ip`,`created_at`);--> statement-breakpoint
CREATE INDEX `recovery_codes_user_idx` ON `recovery_codes` (`staff_user_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`staff_user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `staff_users_role_idx` ON `staff_users` (`role`,`status`);