CREATE TABLE `personal_memes` (
	`owner_id` text NOT NULL,
	`title_key` text NOT NULL,
	`id` text NOT NULL,
	`revision` text NOT NULL,
	`recipe` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `title_key`, `id`)
);
--> statement-breakpoint
CREATE TABLE `personal_posters` (
	`owner_id` text NOT NULL,
	`title_key` text NOT NULL,
	`revision` text NOT NULL,
	`photo` text NOT NULL,
	PRIMARY KEY(`owner_id`, `title_key`)
);
--> statement-breakpoint
CREATE TABLE `reaction_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`title_key` text NOT NULL,
	`title_name` text NOT NULL,
	`episode_id` integer NOT NULL,
	`field` text NOT NULL,
	`value` text,
	`label` text,
	`reacted_on` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reaction_events_target` ON `reaction_events` (`owner_id`,`title_key`,`episode_id`,`field`,`id`);--> statement-breakpoint
CREATE INDEX `reaction_events_date` ON `reaction_events` (`owner_id`,`reacted_on`);--> statement-breakpoint
ALTER TABLE `watch_sessions` ADD `episode_label` text;--> statement-breakpoint
ALTER TABLE `watch_sessions` ADD `duration_seconds` integer;