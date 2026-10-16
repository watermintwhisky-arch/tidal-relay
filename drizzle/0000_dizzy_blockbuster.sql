CREATE TABLE `matches` (
	`code` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
