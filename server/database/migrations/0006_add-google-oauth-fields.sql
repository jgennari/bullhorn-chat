ALTER TABLE `users` ADD `googleAccessToken` text;
ALTER TABLE `users` ADD `googleRefreshToken` text;
ALTER TABLE `users` ADD `googleTokenExpiresAt` integer;
ALTER TABLE `users` ADD `googleEmail` text;