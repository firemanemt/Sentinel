ALTER TABLE `users` ADD `stripeCustomerId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` varchar(32) DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionPeriodEnd` timestamp;