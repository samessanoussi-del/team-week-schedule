# Quick Start Guide - Supabase Integration

## ✅ What's Been Done

1. ✅ Added Supabase client library to HTML files
2. ✅ Created Supabase configuration file (`supabase-config.js`)
3. ✅ Replaced localStorage with Supabase database operations
4. ✅ Added real-time subscriptions for live updates
5. ✅ Created database schema SQL script

## 🚀 Next Steps (Do These Now!)

### Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your "Team Week Schedule Tool" project
3. Click **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string under "Project API keys")

### Step 2: Update Configuration File

1. Open `supabase-config.js` in your project
2. Replace `YOUR_SUPABASE_URL` with your Project URL
3. Replace `YOUR_SUPABASE_ANON_KEY` with your anon public key

Example:
```javascript
const SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Step 3: Create Database Tables

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy and paste the SQL from `SUPABASE_SETUP.md` (the big SQL block)
4. Click **Run** (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

### Step 4: Enable Realtime

1. In Supabase dashboard, go to **Database** → **Replication**
2. Enable replication for these tables:
   - ✅ `team_members`
   - ✅ `clients`
   - ✅ `schedule`
   - ✅ `app_settings`

### Step 5: Test It!

1. Open your website in two different browser windows (or two different computers)
2. Make a change in one window (add a team member, assign someone, etc.)
3. Watch it appear instantly in the other window! 🎉

## 🔧 How It Works

- **Real-time sync**: When someone makes a change, Supabase sends updates to all connected browsers instantly
- **Automatic fallback**: If Supabase is unavailable, it falls back to localStorage
- **No page refresh needed**: Changes appear immediately on all devices

## 🐛 Troubleshooting

**"supabase is not defined" error:**
- Make sure you updated `supabase-config.js` with your credentials
- Check browser console for the exact error

**Changes not syncing:**
- Make sure Realtime is enabled for all 4 tables
- Check browser console for errors
- Verify your Supabase URL and key are correct

**Database errors:**
- Make sure you ran the SQL script to create tables
- Check that RLS policies are set (the SQL script includes this)

## 📝 Notes

- Admin mode still uses localStorage (per device)
- All other data syncs in real-time across all devices
- First load might be slow as it migrates from localStorage to Supabase





