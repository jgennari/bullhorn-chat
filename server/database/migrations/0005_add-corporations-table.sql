-- Create corporations table
CREATE TABLE `corporations` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prompt` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);

-- Add index on corporation id for faster lookups
CREATE INDEX `corpIdIdx` ON `corporations` (`id`);