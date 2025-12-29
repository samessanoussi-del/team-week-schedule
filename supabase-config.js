// Supabase Configuration
// Replace these values with your Supabase project credentials
// You can find these in your Supabase project settings under API

const SUPABASE_URL = 'https://krhrnmejubzazdzpnhci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bP_8yIIapX7PmstFuzrXxw_bAKYzL3k';

// Initialize Supabase client
// The UMD build from CDN exposes it as window.supabase (the library)
// We need to call createClient() to get the client instance
(function() {
    'use strict';
    var supabaseClient;
    try {
        // Check what's available on window
        console.log('Checking for Supabase library...', {
            'window.supabase': typeof window.supabase,
            'window.supabaseJs': typeof window.supabaseJs,
            'window.supabase.createClient': typeof (window.supabase && window.supabase.createClient)
        });
        
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized successfully');
        } else {
            console.error('❌ Supabase library not found or createClient not available');
            console.log('Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('supabase')));
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
} else {
    // If supabase already exists, it might be the library itself, not the client
    console.warn('⚠️ Variable "supabase" already exists. Using window.supabaseClient instead.');
    var supabase = window.supabaseClient;
}

