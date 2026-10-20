CREATE TABLE `worker_heartbeats` (
	`worker_id` varchar(64) NOT NULL,
	`mode` varchar(16) NOT NULL,
	`started_at` datetime(3) NOT NULL,
	`beat_at` datetime(3) NOT NULL,
	`jobs_done` int NOT NULL DEFAULT 0,
	`jobs_failed` int NOT NULL DEFAULT 0,
	CONSTRAINT `worker_heartbeats_worker_id` PRIMARY KEY(`worker_id`)
);
