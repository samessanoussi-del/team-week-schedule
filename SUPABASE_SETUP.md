# Supabase Setup Instructions

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your "Team Week Schedule Tool" project
3. Click on "Settings" (gear icon) in the left sidebar
4. Click on "API" in the settings menu
5. Copy the following:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")

## Step 2: Update Configuration

1. Open `supabase-config.js` in your project
2. Replace `YOUR_SUPABASE_URL` with your Project URL
3. Replace `YOUR_SUPABASE_ANON_KEY` with your anon public key

## Step 3: Create Database Tables

Go to your Supabase project dashboard and click on "SQL Editor" in the left sidebar. Then run the following SQL to create the necessary tables:

```sql
-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#ce2828',
  profile_picture TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#667eea',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create schedule table
CREATE TABLE IF NOT EXISTS schedule (
  id BIGSERIAL PRIMARY KEY,
  block_key TEXT NOT NULL UNIQUE,
  assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create app_settings table (for time blocks, theme, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - we'll make it public for now
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (public access)
-- In production, you may want to restrict this
CREATE POLICY "Allow all operations on team_members" ON team_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on clients" ON clients
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on schedule" ON schedule
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on app_settings" ON app_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schedule_block_key ON schedule(block_key);
CREATE INDEX IF NOT EXISTS idx_team_members_name ON team_members(name);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Create weekly_time_tracking table
CREATE TABLE IF NOT EXISTS weekly_time_tracking (
    id BIGSERIAL PRIMARY KEY,
    week_key TEXT NOT NULL,
    member_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(week_key, member_name, client_name)
);

-- Enable Row Level Security
ALTER TABLE weekly_time_tracking ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (read and write)
CREATE POLICY "Allow all operations on weekly_time_tracking" ON weekly_time_tracking
    FOR ALL USING (true) WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_weekly_time_tracking_week_key ON weekly_time_tracking(week_key);
```

## Step 4: Enable Realtime

1. In your Supabase dashboard, go to "Database" → "Replication"
2. Enable replication for the following tables:
   - `team_members`
   - `clients`
   - `schedule`
   - `app_settings`
   - `weekly_time_tracking`

## Step 5: Test the Connection

1. Open your website
2. Open browser console (F12)
3. Check for any errors
4. Try making a change and see if it syncs

## Troubleshooting

- **Connection errors**: Make sure your Supabase URL and key are correct
- **Permission errors**: Check that RLS policies are set correctly
- **Realtime not working**: Make sure Realtime is enabled for the tables
- **Data not syncing**: Check browser console for errors

