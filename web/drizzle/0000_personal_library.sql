CREATE TABLE `library_tvmaze_shows` (
	`owner_id` text NOT NULL,
	`show_id` integer NOT NULL,
	`details` text NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `show_id`)
);
--> statement-breakpoint
CREATE TABLE `watched_tvmaze_episodes` (
	`owner_id` text NOT NULL,
	`show_id` integer NOT NULL,
	`episode_id` integer NOT NULL,
	`watched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `show_id`, `episode_id`),
	FOREIGN KEY (`owner_id`,`show_id`) REFERENCES `library_tvmaze_shows`(`owner_id`,`show_id`) ON UPDATE no action ON DELETE cascade
);
