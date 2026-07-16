CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`homeZipCode` varchar(20),
	`preferredVoiceKey` varchar(64),
	`preferredLayout` varchar(32),
	`speechRate` text,
	`reverbIntensity` text,
	`extraData` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_key_unique` UNIQUE(`key`)
);
