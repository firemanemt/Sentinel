CREATE TABLE `google_oauth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiryDate` text,
	`tokenType` varchar(32),
	`scope` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_oauth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_oauth_tokens_key_unique` UNIQUE(`key`)
);
