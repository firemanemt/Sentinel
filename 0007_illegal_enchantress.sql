CREATE TABLE `morning_routine_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`sections` text NOT NULL DEFAULT ('["weather","alerts","calendar","email","reminders"]'),
	`wakeTime` varchar(8) DEFAULT '07:00',
	`musicQuery` text DEFAULT ('Highway to Hell AC/DC'),
	`customGreeting` text DEFAULT ('Good morning, sir'),
	`readAloud` int NOT NULL DEFAULT 1,
	`weatherLocation` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `morning_routine_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `morning_routine_config_key_unique` UNIQUE(`key`)
);
