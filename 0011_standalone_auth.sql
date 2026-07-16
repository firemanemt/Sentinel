-- Migration 0011: Standalone Auth
-- Makes email required, openId optional, adds password column
-- Run this on your MySQL database when migrating from Manus-hosted to standalone

-- Add password column
ALTER TABLE `users` ADD COLUMN `password` TEXT NULL AFTER `email`;

-- Make email NOT NULL and add unique index (may fail if duplicates exist — clean those first)
ALTER TABLE `users` MODIFY COLUMN `email` VARCHAR(320) NOT NULL;
ALTER TABLE `users` ADD UNIQUE INDEX `users_email_unique` (`email`);

-- Make openId nullable (drop NOT NULL constraint)
ALTER TABLE `users` MODIFY COLUMN `openId` VARCHAR(64) NULL;
-- Drop the unique index on openId if it exists, then re-add as nullable unique
ALTER TABLE `users` DROP INDEX `users_openId_unique`;
ALTER TABLE `users` ADD UNIQUE INDEX `users_openId_unique` (`openId`);
