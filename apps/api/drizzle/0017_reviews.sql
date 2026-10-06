CREATE TABLE `review_photos` (
	`review_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`media_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`sort_order` smallint NOT NULL,
	CONSTRAINT `review_photos_review_id_media_id_pk` PRIMARY KEY(`review_id`,`media_id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` char(36) character set ascii collate ascii_bin NOT NULL,
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`order_line_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`display_name` varchar(40) NOT NULL,
	`rating` tinyint NOT NULL,
	`title` varchar(100),
	`body` varchar(1000) NOT NULL,
	`fit` varchar(16) character set ascii collate ascii_bin,
	`status` varchar(16) character set ascii collate ascii_bin NOT NULL DEFAULT 'pending',
	`reject_reason` varchar(24) character set ascii collate ascii_bin,
	`reject_note` varchar(300),
	`reply_body` varchar(600),
	`reply_at` datetime(3),
	`moderated_by` char(36) character set ascii collate ascii_bin,
	`moderated_at` datetime(3),
	`locale` varchar(5) character set ascii collate ascii_bin NOT NULL DEFAULT 'en',
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_order_line_uq` UNIQUE(`order_line_id`),
	CONSTRAINT `reviews_rating_chk` CHECK(`reviews`.`rating` BETWEEN 1 AND 5),
	CONSTRAINT `reviews_status_chk` CHECK(`reviews`.`status` IN ('pending', 'approved', 'rejected')),
	CONSTRAINT `reviews_fit_chk` CHECK(`reviews`.`fit` IS NULL OR `reviews`.`fit` IN ('runs_small', 'true_to_size', 'runs_large')),
	CONSTRAINT `reviews_reject_reason_chk` CHECK(`reviews`.`reject_reason` IS NULL OR `reviews`.`reject_reason` IN ('offensive', 'personal_data', 'not_about_product', 'spam', 'other'))
);
--> statement-breakpoint
ALTER TABLE `review_photos` ADD CONSTRAINT `review_photos_review_fk` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_photos` ADD CONSTRAINT `review_photos_media_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_line_fk` FOREIGN KEY (`order_line_id`) REFERENCES `order_lines`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_moderator_fk` FOREIGN KEY (`moderated_by`) REFERENCES `staff_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `reviews_product_idx` ON `reviews` (`product_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_status_idx` ON `reviews` (`status`,`created_at`);