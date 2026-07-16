CREATE TABLE `integration_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service` varchar(64) NOT NULL,
	`token` text NOT NULL,
	`extra` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_tokens_service_unique` UNIQUE(`service`)
);
