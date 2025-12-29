-- Add weekly_time_tracking table (run only this if other tables already exist)
-- This is the NEW table needed for the time tracking feature

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


