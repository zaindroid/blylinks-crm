-- The "QA Review" default group was briefly named "Administrative Review". Rename it
-- only where it still has that exact seeded name, so a name an Admin chose themselves
-- is never overwritten.
UPDATE message_groups SET name = 'QA Review' WHERE id = 'qa-support' AND name = 'Administrative Review';
