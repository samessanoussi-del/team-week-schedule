// Supabase Configuration
// Replace these values with your Supabase project credentials
// You can find these in your Supabase project settings under API

const SUPABASE_URL = 'https://krhrnmejubzazdzpnhci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bP_8yIIapX7PmstFuzrXxw_bAKYzL3k';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

