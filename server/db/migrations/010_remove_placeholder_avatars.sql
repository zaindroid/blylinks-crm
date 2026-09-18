-- Every account created through the app used to be given the same stock photo of a stranger
-- as a placeholder. Nothing in the app lets a user set their own picture, so every avatar
-- pointing at that stock host is a placeholder. Clear them; the UI shows initials instead.
UPDATE users SET avatar = NULL WHERE avatar LIKE 'https://images.unsplash.com/%';
