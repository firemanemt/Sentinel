CREATE TABLE `conversation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`toolsUsed` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
