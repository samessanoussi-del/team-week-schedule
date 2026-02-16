-- Run this in Supabase SQL Editor to add profile columns to online_users
-- so the "who is online" strip can show names, profile pictures, and colors.

-- Add columns if they don't exist (safe to run multiple times)
ALTER TABLE online_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE online_users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE online_users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE online_users ADD COLUMN IF NOT EXISTS avatar_border_color TEXT DEFAULT '#318cc3';
ALTER TABLE online_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE online_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Optional: ensure email is unique so the app can upsert by email.
-- If you get "duplicate key" or upsert errors, run this once:
--   ALTER TABLE online_users ADD CONSTRAINT online_users_email_key UNIQUE (email);
