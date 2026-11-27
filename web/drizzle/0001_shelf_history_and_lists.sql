CREATE TABLE `personal_lists` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`titles` text NOT NULL,
	`revision` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `shelf_entries` (
	`owner_id` text NOT NULL,
	`title_key` text NOT NULL,
	`details` text NOT NULL,
	`status` text,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `title_key`)
);
--> statement-breakpoint
CREATE TABLE `shelf_imports` (
	`owner_id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watch_operations` (
	`owner_id` text NOT NULL,
	`title_key` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	`nonce` text NOT NULL,
	PRIMARY KEY(`owner_id`, `title_key`, `id`)
);
--> statement-breakpoint
CREATE TABLE `watch_sessions` (
	`owner_id` text NOT NULL,
	`title_key` text NOT NULL,
	`id` text NOT NULL,
	`episode_id` integer,
	`watched_on` text NOT NULL,
	`operation_id` text,
	PRIMARY KEY(`owner_id`, `title_key`, `id`),
	FOREIGN KEY (`owner_id`,`title_key`) REFERENCES `shelf_entries`(`owner_id`,`title_key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watch_sessions_item` ON `watch_sessions` (`owner_id`,`title_key`,`episode_id`);--> statement-breakpoint
CREATE INDEX `watch_sessions_operation` ON `watch_sessions` (`owner_id`,`title_key`,`operation_id`);