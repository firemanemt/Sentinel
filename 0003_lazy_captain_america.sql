CREATE TABLE `reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`text` text NOT NULL,
	`dueAt` timestamp NOT NULL,
	`fired` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spotify_oauth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiryDate` text,
	`tokenType` varchar(32),
	`scope` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spotify_oauth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `spotify_oauth_tokens_key_unique` UNIQUE(`key`)
);
