// Supabase Configuration
// Replace these values with your Supabase project credentials
// You can find these in your Supabase project settings under API

const SUPABASE_URL = 'https://krhrnmejubzazdzpnhci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bP_8yIIapX7PmstFuzrXxw_bAKYzL3k';

// Initialize Supabase client
// The UMD build exposes it as window.supabase
let supabase;
try {
    if (typeof window !== 'undefined' && window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
    } else {
        console.warn('Supabase library not loaded. Make sure the script is included before this file.');
        supabase = undefined;
    }
} catch (error) {
    console.error('Error initializing Supabase:', error);
    supabase = undefined;
}

