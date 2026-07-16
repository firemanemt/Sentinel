CREATE TABLE `apple_caldav_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`appleId` varchar(320) NOT NULL,
	`appPassword` text NOT NULL,
	`serverUrl` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apple_caldav_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `apple_caldav_credentials_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `microsoft_oauth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiryDate` text,
	`tokenType` varchar(32),
	`scope` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `microsoft_oauth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `microsoft_oauth_tokens_key_unique` UNIQUE(`key`)
);
