// Supabase Configuration
// Replace these values with your Supabase project credentials
// You can find these in your Supabase project settings under API

const SUPABASE_URL = 'https://krhrnmejubzazdzpnhci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bP_8yIIapX7PmstFuzrXxw_bAKYzL3k';

// Initialize Supabase client
// The UMD build exposes it as window.supabase
// Use a different variable name to avoid conflicts
var supabaseClient;
try {
    if (typeof window !== 'undefined' && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized successfully');
    } else {
        console.warn('⚠️ Supabase library not loaded. Make sure the script is included before this file.');
        supabaseClient = undefined;
    }
} catch (error) {
    console.error('❌ Error initializing Supabase:', error);
    supabaseClient = undefined;
}

// Export as 'supabase' for use in app.js
const supabase = supabaseClient;

