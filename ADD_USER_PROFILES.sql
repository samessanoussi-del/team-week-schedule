-- Run this in Supabase SQL Editor to create the user_profiles table for storing profile data online.
-- Profile picture is stored as a data URL (can be long); Supabase text type supports it.

CREATE TABLE IF NOT EXISTS user_profiles (
    email TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    profile_picture_url TEXT,
    avatar_border_color TEXT DEFAULT '#318cc3',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anonymous read/write for now (adjust RLS if you add auth later)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for user_profiles" ON user_profiles
    FOR ALL USING (true) WITH CHECK (true);
