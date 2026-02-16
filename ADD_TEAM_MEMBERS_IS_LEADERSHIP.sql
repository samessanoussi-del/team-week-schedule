-- Run this in Supabase SQL Editor to store production and leadership members
-- in the same table (team_members), distinguished by is_leadership.
-- On the site they are still shown as "Production Members" and "Leadership Members".

-- Add column if it doesn't exist (safe to run multiple times)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_leadership BOOLEAN NOT NULL DEFAULT false;

-- Optional: migrate existing leadership_members into team_members (run only if you have a leadership_members table)
-- INSERT INTO team_members (name, color, profile_picture, is_leadership)
-- SELECT name, color, profile_picture, true
-- FROM leadership_members
-- ON CONFLICT DO NOTHING;
-- (Adjust if your table has no unique constraint; you may need to skip duplicates by name in the app instead.)
