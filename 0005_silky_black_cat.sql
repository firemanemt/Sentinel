CREATE TABLE `discord_lost_pet_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` varchar(64) NOT NULL,
	`messageId` varchar(64) NOT NULL,
	`petType` varchar(128),
	`description` text,
	`lastSeen` text,
	`ownerName` varchar(256),
	`ownerEmail` varchar(320),
	`ownerPhone` varchar(32),
	`location` text,
	`status` varchar(64) DEFAULT 'unassigned',
	`postedAt` timestamp,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`rawEmbed` text,
	CONSTRAINT `discord_lost_pet_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `discord_lost_pet_cases_caseId_unique` UNIQUE(`caseId`),
	CONSTRAINT `discord_lost_pet_cases_messageId_unique` UNIQUE(`messageId`)
);
