ALTER TABLE `apple_caldav_credentials` RENAME COLUMN `key` TO `userId`;--> statement-breakpoint
ALTER TABLE `google_oauth_tokens` RENAME COLUMN `key` TO `userId`;--> statement-breakpoint
ALTER TABLE `microsoft_oauth_tokens` RENAME COLUMN `key` TO `userId`;--> statement-breakpoint
ALTER TABLE `morning_routine_config` RENAME COLUMN `key` TO `userId`;--> statement-breakpoint
ALTER TABLE `spotify_oauth_tokens` RENAME COLUMN `key` TO `userId`;--> statement-breakpoint
ALTER TABLE `user_preferences` RENAME COLUMN `key` TO `userId`;--> statement-breakpoint
ALTER TABLE `apple_caldav_credentials` DROP INDEX `apple_caldav_credentials_key_unique`;--> statement-breakpoint
ALTER TABLE `google_oauth_tokens` DROP INDEX `google_oauth_tokens_key_unique`;--> statement-breakpoint
ALTER TABLE `integration_tokens` DROP INDEX `integration_tokens_service_unique`;--> statement-breakpoint
ALTER TABLE `microsoft_oauth_tokens` DROP INDEX `microsoft_oauth_tokens_key_unique`;--> statement-breakpoint
ALTER TABLE `morning_routine_config` DROP INDEX `morning_routine_config_key_unique`;--> statement-breakpoint
ALTER TABLE `spotify_oauth_tokens` DROP INDEX `spotify_oauth_tokens_key_unique`;--> statement-breakpoint
ALTER TABLE `user_preferences` DROP INDEX `user_preferences_key_unique`;--> statement-breakpoint
ALTER TABLE `apple_caldav_credentials` MODIFY COLUMN `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `google_oauth_tokens` MODIFY COLUMN `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `microsoft_oauth_tokens` MODIFY COLUMN `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `morning_routine_config` MODIFY COLUMN `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `spotify_oauth_tokens` MODIFY COLUMN `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` MODIFY COLUMN `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `conversation_messages` ADD `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `integration_tokens` ADD `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `reminders` ADD `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `apple_caldav_credentials` ADD CONSTRAINT `apple_caldav_credentials_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
ALTER TABLE `google_oauth_tokens` ADD CONSTRAINT `google_oauth_tokens_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
ALTER TABLE `microsoft_oauth_tokens` ADD CONSTRAINT `microsoft_oauth_tokens_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
ALTER TABLE `morning_routine_config` ADD CONSTRAINT `morning_routine_config_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
ALTER TABLE `spotify_oauth_tokens` ADD CONSTRAINT `spotify_oauth_tokens_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`);