-- Add userType column to users table with default value 'user'
ALTER TABLE `users` ADD COLUMN `userType` text NOT NULL DEFAULT 'user';