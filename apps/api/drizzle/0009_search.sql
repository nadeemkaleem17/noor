CREATE TABLE `product_search` (
	`product_id` char(36) character set ascii collate ascii_bin NOT NULL,
	`title_text` varchar(400) NOT NULL,
	`body_text` text NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `product_search_product_id` PRIMARY KEY(`product_id`)
);
--> statement-breakpoint
CREATE TABLE `search_misses` (
	`day` date NOT NULL,
	`query` varchar(80) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	CONSTRAINT `search_misses_day_query_pk` PRIMARY KEY(`day`,`query`)
);
--> statement-breakpoint
CREATE TABLE `search_synonyms` (
	`term` varchar(60) NOT NULL,
	`expands_to` varchar(200) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `search_synonyms_term` PRIMARY KEY(`term`)
);
--> statement-breakpoint
ALTER TABLE `product_search` ADD CONSTRAINT `product_search_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Hand-written: FULLTEXT indexes. The stopword list is switched off for the session that creates them, so words like "in", "for" and "the"
-- inside product names stay searchable (plan/09-data-model/05-search.md section 2.1). innodb_ft_min_token_size=2 is a server setting (plan/14).
SET SESSION innodb_ft_enable_stopword = 0;
--> statement-breakpoint
ALTER TABLE `product_search` ADD FULLTEXT INDEX `product_search_title_ft` (`title_text`);
--> statement-breakpoint
ALTER TABLE `product_search` ADD FULLTEXT INDEX `product_search_all_ft` (`title_text`, `body_text`);
