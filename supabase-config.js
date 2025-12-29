// Supabase Configuration
// Replace these values with your Supabase project credentials
// You can find these in your Supabase project settings under API

const SUPABASE_URL = 'https://krhrnmejubzazdzpnhci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bP_8yIIapX7PmstFuzrXxw_bAKYzL3k';

// Initialize Supabase client
// The UMD build exposes it as window.supabase
// Use IIFE to avoid variable conflicts
(function() {
    'use strict';
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
    
    // Store on window object to avoid variable conflicts
    window.supabaseClient = supabaseClient;
})();

// Create a local reference for app.js to use (only if not already declared)
if (typeof supabase === 'undefined') {
    var supabase = window.supabaseClient;
}

