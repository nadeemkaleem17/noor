CREATE TABLE `web_vitals_daily` (
	`day` date NOT NULL,
	`route` varchar(40) character set ascii collate ascii_bin NOT NULL,
	`metric` varchar(4) character set ascii collate ascii_bin NOT NULL,
	`bucket` smallint NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `web_vitals_daily_day_route_metric_bucket_pk` PRIMARY KEY(`day`,`route`,`metric`,`bucket`)
);
