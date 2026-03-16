// Data storage
let teamMembers = []; // Format: [{ name: "John", color: "#ce2828", profilePicture: "data:image/..." }, ...]
let leadershipMembers = []; // Format: [{ name: "John", color: "#ce2828", profilePicture: "data:image/..." }, ...]
let clients = []; // Format: [{ name: "Client A", color: "#667eea" }, ...]
let schedule = {}; // Production only: { "2024-01-15-Monday-Work1": [{ member: "John", client: "Client A", project?: "Project Name" }, ...] }
let leadershipSchedule = {}; // Leadership only: same assignment shape with optional project
let projects = []; // { id?, clientName, name, budget, color } - primary list in Settings; clients derived from projects
let currentWeekStart = new Date();
let isDarkTheme = true; // Default to dark theme
let timeBlocks = []; // Production blocks only (Work1, Work2, Work3, Lunch) - no leadership blocks

// currentWeekStart is stored locally per-device.
// IMPORTANT: store as local date-only (YYYY-MM-DD) to avoid UTC shifting from toISOString().
function formatLocalDateOnly(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getMondayForDate(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0=Sun..6=Sat
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function loadCurrentWeekStartFromLocalStorage() {
    const raw = localStorage.getItem('currentWeekStart');
    if (!raw) return null;

    // New format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            return getMondayForDate(new Date(y, m - 1, d));
        }
    }

    // Back-compat: ISO string / Date.parse-able
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
        const monday = getMondayForDate(parsed);
        // Migrate to safe local format so it won't "shift" again
        localStorage.setItem('currentWeekStart', formatLocalDateOnly(monday));
        return monday;
    }

    return null;
}

function saveCurrentWeekStartToLocalStorage(date) {
    const monday = getMondayForDate(date);
    localStorage.setItem('currentWeekStart', formatLocalDateOnly(monday));
}

function isLeadershipBlockKey(key) {
    return typeof key === 'string' && key.indexOf('-leadership-') !== -1;
}

function normalizeProductionBlockKey(key) {
    if (!key || typeof key !== 'string') return key;
    if (isLeadershipBlockKey(key)) return key;

    // Expected: YYYY-MM-DD-DayName-BlockId (BlockId may contain dashes)
    const parts = key.split('-');
    if (parts.length < 5) return key;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return key;

    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return key;

    const actualDayName = getDayNameFromDate(date);
    const blockId = parts.slice(4).join('-');
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}-${actualDayName}-${blockId}`;
}

// Derive clients list from projects (unique clientName with color from first project)
function getDerivedClientsFromProjects() {
    const byName = {};
    projects.forEach(p => {
        const c = p.clientName || p.name;
        if (c && !byName[c]) byName[c] = p.color || '#667eea';
    });
    return Object.entries(byName).map(([name, color]) => ({ name, color }));
}
let isAdminMode = false; // View mode by default
const ADMIN_PASSWORD = 'Ravie2026';
let weeklyTimeTracking = {}; // Format: { "2024-01-15": { "John": { "Client A": 5.5 }, ... }, ... }
let clientDetails = {}; // Format: { "Client A": { deadline: "2025-02-20", stops: [ { name: "Design", due: "2025-02-01" }, ... ] }, ... }
let currentUser = null; // { email, firstName, lastName, profilePictureUrl } from localStorage or Supabase Auth
let onlineUsersFromServer = []; // who is online (from online_users table)

// Auth (localStorage-based; can be replaced with Supabase Auth)
function showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

function setupAuthListeners() {
    const authTabs = document.getElementById('authTabs');
    const signInForm = document.getElementById('authSignInForm');
    const signUpForm = document.getElementById('authSignUpForm');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:setupAuthListeners',message:'entry',data:{hasAuthTabs:!!authTabs,hasSignInForm:!!signInForm,hasSignUpForm:!!signUpForm},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    console.log('[Auth] setupAuthListeners: forms=', !!signInForm, !!signUpForm, 'tabs=', !!authTabs);
    if (!signInForm || !signUpForm) {
        console.warn('[Auth] setupAuthListeners: missing form(s), listeners NOT attached');
        return;
    }

    // Tab switch: use delegation so clicks always work
    if (authTabs) {
        authTabs.addEventListener('click', (e) => {
            const tab = e.target && e.target.closest && e.target.closest('.auth-tab');
            if (!tab) return;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:authTabClick',message:'tab clicked',data:{dataTab:tab.getAttribute('data-tab')},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
            // #endregion
            console.log('[Auth] Tab clicked:', tab.getAttribute('data-tab'));
            const isSignUp = tab.getAttribute('data-tab') === 'signup';
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            signInForm.style.display = isSignUp ? 'none' : 'flex';
            signUpForm.style.display = isSignUp ? 'flex' : 'none';
        });
    }

    signInForm.addEventListener('submit', (e) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:signInSubmit',message:'sign-in submit fired',data:{},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        console.log('[Auth] Sign-in submit handler ran');
        e.preventDefault();
        const emailEl = document.getElementById('authEmailSignIn');
        const passwordEl = document.getElementById('authPasswordSignIn');
        const email = (emailEl && emailEl.value || '').trim();
        const password = passwordEl ? passwordEl.value : '';
        if (!email) {
            alert('Please enter your email.');
            return;
        }
        let stored = {};
        try {
            stored = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
        } catch (_) {}
        const user = stored[email];
        if (!user || user.password !== password) {
            alert('Invalid email or password. If you never signed up, use the Sign up tab to create an account.');
            return;
        }
        currentUser = { email: user.email, firstName: user.firstName, lastName: user.lastName, profilePictureUrl: user.profilePictureUrl || '', avatarBorderColor: user.avatarBorderColor || '#318cc3' };
        try {
            localStorage.setItem('teamScheduleUser', JSON.stringify(currentUser));
        } catch (_) {}
        location.reload();
    });

    signUpForm.addEventListener('submit', (e) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:signUpSubmit',message:'sign-up submit fired',data:{},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        console.log('[Auth] Sign-up submit handler ran');
        e.preventDefault();
        const firstName = (document.getElementById('authFirstName') && document.getElementById('authFirstName').value || '').trim();
        const lastName = (document.getElementById('authLastName') && document.getElementById('authLastName').value || '').trim();
        const email = (document.getElementById('authEmailSignUp') && document.getElementById('authEmailSignUp').value || '').trim();
        const password = document.getElementById('authPasswordSignUp') ? document.getElementById('authPasswordSignUp').value : '';
        if (!email) {
            alert('Please enter your email.');
            return;
        }
        let stored = {};
        try {
            stored = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
        } catch (_) {}
        if (stored[email]) {
            alert('An account with this email already exists. Sign in instead.');
            return;
        }
        stored[email] = { email, firstName, lastName, password, profilePictureUrl: '', avatarBorderColor: '#318cc3' };
        try {
            localStorage.setItem('teamScheduleUsers', JSON.stringify(stored));
            currentUser = { email, firstName, lastName, profilePictureUrl: '', avatarBorderColor: '#318cc3' };
            localStorage.setItem('teamScheduleUser', JSON.stringify(currentUser));
        } catch (err) {
            alert('Could not save account (e.g. private browsing). Try a different browser or allow site data.');
            return;
        }
        location.reload();
    });
}

// Resize a data URL image to max size and JPEG quality to avoid statement timeout when saving to Supabase
function resizeProfilePictureDataUrl(dataUrl, maxPx, quality) {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return Promise.resolve(dataUrl);
    return new Promise(function (resolve) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            var w = img.width, h = img.height;
            if (w <= maxPx && h <= maxPx) { resolve(dataUrl); return; }
            var scale = maxPx / Math.max(w, h);
            var c = document.createElement('canvas');
            c.width = Math.round(w * scale);
            c.height = Math.round(h * scale);
            var ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, c.width, c.height);
            try {
                resolve(c.toDataURL('image/jpeg', quality || 0.8));
            } catch (e) {
                resolve(dataUrl);
            }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
    });
}

// Profile stored online (Supabase). Run ADD_USER_PROFILES.sql in Supabase to create the table.
function getSupabaseClient() {
    return (typeof window !== 'undefined' && window.supabaseClient) || (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function' ? supabase : null);
}

async function loadProfileFromSupabase(email) {
    const client = getSupabaseClient();
    if (!client || !email) return null;
    try {
        const { data, error } = await client.from('user_profiles').select('first_name, last_name, profile_picture_url, avatar_border_color').eq('email', email).maybeSingle();
        if (error) {
            console.warn('Profile load from Supabase:', error.message);
            return null;
        }
        return data;
    } catch (e) {
        console.warn('Profile load error:', e);
        return null;
    }
}

async function saveProfileToSupabase(profile) {
    const client = getSupabaseClient();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:saveProfileToSupabase',message:'saveProfileToSupabase called',data:{hasClient:!!client,hasProfile:!!profile,email:profile&&profile.email?profile.email.substring(0,3)+'...':null},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    if (!client || !profile || !profile.email) {
        return { ok: false, message: 'Not connected to Supabase. Check supabase-config.js and that the script loads.' };
    }
    const picLen = (profile.profilePictureUrl && profile.profilePictureUrl.length) || 0;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:saveProfileToSupabase',message:'payload before upsert',data:{profilePictureUrlLength:picLen,isDataUrl:!!(profile.profilePictureUrl&&profile.profilePictureUrl.startsWith('data:'))},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    try {
        const { error } = await client.from('user_profiles').upsert({
            email: profile.email,
            first_name: profile.firstName || null,
            last_name: profile.lastName || null,
            profile_picture_url: profile.profilePictureUrl || null,
            avatar_border_color: profile.avatarBorderColor || '#318cc3',
            updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
        if (error) {
            console.error('Profile save to Supabase:', error);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:saveProfileToSupabase',message:'Supabase upsert error',data:{errorMessage:error.message||'',errorCode:error.code||''},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
            // #endregion
            const msg = error.message || String(error.code || '');
            const hint = msg.includes('user_profiles') || msg.includes('does not exist') || msg.includes('schema cache')
                ? ' Run ADD_USER_PROFILES.sql in Supabase SQL Editor (see that file in your project).'
                : msg.includes('timeout')
                ? ' Your profile picture may be too large; try a smaller image or the app will resize it automatically on next save.'
                : '';
            return { ok: false, message: (msg || 'Server rejected the save.') + hint };
        }
        return { ok: true };
    } catch (e) {
        console.error('Profile save error:', e);
        const msg = e && e.message ? e.message : String(e);
        const hint = msg.includes('user_profiles') || msg.includes('does not exist') || msg.includes('schema cache')
            ? ' Run ADD_USER_PROFILES.sql in Supabase SQL Editor.'
            : msg.includes('timeout')
            ? ' Your profile picture may be too large; try a smaller image or the app will resize it automatically on next save.'
            : '';
        return { ok: false, message: (msg || 'Network or connection error.') + hint };
    }
}

// Who is online: check in to online_users and fetch list for strip
async function updateMyOnlinePresence() {
    const client = getSupabaseClient();
    if (!client || !currentUser || !currentUser.email) return;
    const row = {
        email: currentUser.email,
        first_name: currentUser.firstName || null,
        last_name: currentUser.lastName || null,
        profile_picture_url: currentUser.profilePictureUrl || null,
        avatar_border_color: currentUser.avatarBorderColor || '#318cc3',
        last_seen_at: new Date().toISOString()
    };
    try {
        const { data: existing } = await client.from('online_users').select('email').eq('email', currentUser.email).maybeSingle();
        if (existing) {
            await client.from('online_users').update(row).eq('email', currentUser.email);
        } else {
            await client.from('online_users').insert(row);
        }
    } catch (e) {
        console.warn('Online presence update failed:', e);
    }
}

async function fetchOnlineUsers() {
    const client = getSupabaseClient();
    if (!client) return;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    try {
        const { data, error } = await client.from('online_users')
            .select('email, first_name, last_name, profile_picture_url, avatar_border_color')
            .gte('last_seen_at', twoMinutesAgo);
        if (!error && Array.isArray(data)) {
            onlineUsersFromServer = data.map(r => ({
                email: r.email,
                firstName: r.first_name,
                lastName: r.last_name,
                profilePictureUrl: r.profile_picture_url || '',
                avatarBorderColor: r.avatar_border_color || '#318cc3'
            }));
            renderOnlineUsersStrip();
        }
    } catch (e) {
        console.warn('Fetch online users failed:', e);
    }
}

// Undo/Redo system
let undoHistory = [];
let maxHistorySize = 50;

// Calculate if a color is light or dark, returns 'white' or 'black' for text color
function getContrastTextColor(backgroundColor) {
    if (!backgroundColor) return 'white';
    
    // Convert hex to RGB
    let r, g, b;
    if (backgroundColor.startsWith('#')) {
        const hex = backgroundColor.slice(1);
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        } else {
            return 'white'; // Invalid hex
        }
    } else if (backgroundColor.startsWith('rgb')) {
        const matches = backgroundColor.match(/\d+/g);
        if (matches && matches.length >= 3) {
            r = parseInt(matches[0]);
            g = parseInt(matches[1]);
            b = parseInt(matches[2]);
        } else {
            return 'white';
        }
    } else {
        return 'white'; // Unknown format
    }
    
    // Calculate relative luminance (WCAG formula)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black for light backgrounds, white for dark backgrounds
    return luminance > 0.5 ? 'black' : 'white';
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    const authScreen = document.getElementById('authScreen');
    const appContainer = document.getElementById('appContainer');
    const authSubtitle = document.getElementById('authSubtitle');
    function showAuth(msg) {
        if (authScreen) authScreen.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        if (authSubtitle && msg) authSubtitle.textContent = msg;
    }
    function showApp() {
        if (authScreen) authScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';
    }
    try {
        console.log('🚀 Initializing app...');
        if (!authScreen || !appContainer) {
            console.log('[Auth] Init: missing authScreen or appContainer, calling setupAuthListeners');
            showAuth('Sign in or create an account to continue');
            if (appContainer) appContainer.style.display = 'flex';
            setupAuthListeners();
            return;
        }
        let storedUser = null;
        try {
            storedUser = JSON.parse(localStorage.getItem('teamScheduleUser') || 'null');
        } catch (_) {}
        if (storedUser && storedUser.email) {
            try {
                const users = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
                const latest = users[storedUser.email];
                if (latest) {
                    storedUser = { ...storedUser, profilePictureUrl: latest.profilePictureUrl || storedUser.profilePictureUrl, avatarBorderColor: latest.avatarBorderColor || storedUser.avatarBorderColor, firstName: latest.firstName ?? storedUser.firstName, lastName: latest.lastName ?? storedUser.lastName };
                }
            } catch (_) {}
        }
        currentUser = storedUser;
        if (!currentUser || !currentUser.email) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:init',message:'calling setupAuthListeners',data:{hasCurrentUser:!!currentUser,hasEmail:!!(currentUser&&currentUser.email)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
            // #endregion
            console.log('[Auth] Init: calling setupAuthListeners (no user)');
            setupAuthListeners();
            return;
        }
        try {
            const profileFromSupabase = await loadProfileFromSupabase(currentUser.email);
            if (profileFromSupabase) {
                currentUser.firstName = profileFromSupabase.first_name ?? currentUser.firstName;
                currentUser.lastName = profileFromSupabase.last_name ?? currentUser.lastName;
                currentUser.profilePictureUrl = profileFromSupabase.profile_picture_url ?? currentUser.profilePictureUrl;
                currentUser.avatarBorderColor = profileFromSupabase.avatar_border_color ?? currentUser.avatarBorderColor;
            }
        } catch (_) {}
        showApp();
        await loadData();
        initializeCalendar();
        setupEventListeners();
        renderSidebar();
        renderSettings();
        updateStats();
        setTimeout(() => { try { setupRealtimeSubscriptions(); } catch (_) {} }, 1500);
        renderTimeTracking();
        updateDayHeaders();
        renderOnlineUsersStrip();
        if (currentUser) {
            try { updateMyOnlinePresence(); } catch (_) {}
            try { fetchOnlineUsers(); } catch (_) {}
            setInterval(() => { try { updateMyOnlinePresence(); } catch (_) {} }, 30000);
            setInterval(() => { try { fetchOnlineUsers(); } catch (_) {} }, 30000);
        }
        console.log('✅ App initialized');
        setInterval(() => { updateDayHeaders(); renderCalendar(); }, 60000);
    } catch (err) {
        console.error('App init error:', err);
        showAuth('Something went wrong. Try signing in again or refresh the page.');
        try { setupAuthListeners(); } catch (_) {}
    }
});

// Real-time subscription channels
let realtimeChannels = {
    teamMembers: null,
    clients: null,
    schedule: null,
    appSettings: null
};

// Flag to prevent recursive updates
let isSaving = false;

// Setup real-time subscriptions
function setupRealtimeSubscriptions() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.warn('⚠️ Supabase not available, real-time subscriptions disabled');
        return;
    }
    
    console.log('🔔 Setting up real-time subscriptions...');
    
    // Subscribe to team_members changes
    realtimeChannels.teamMembers = supabase
        .channel('team_members_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, async (payload) => {
            if (isSaving) return;
            console.log('📢 Real-time update: team_members changed', payload.eventType);
            await loadTeamMembers(true);
            renderSidebar();
            renderSettings();
            renderCalendar();
            updateStats();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Team members subscription active');
            }
        });

    // Subscribe to clients changes
    realtimeChannels.clients = supabase
        .channel('clients_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, async (payload) => {
            // Skip if we're currently saving to prevent loops
            if (isSaving) {
                console.log('⏭️ Skipping real-time update (save in progress)');
                return;
            }
            console.log('📢 Real-time update: clients changed', payload.eventType);
            await loadClients(true); // Skip defaults on real-time updates
            renderSidebar();
            renderSettings();
            renderCalendar();
            updateStats();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Clients subscription active');
            }
        });

    // Subscribe to schedule changes
    realtimeChannels.schedule = supabase
        .channel('schedule_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, async (payload) => {
            // Skip if we're currently saving to prevent loops
            if (isSaving) {
                console.log('⏭️ Skipping real-time update (save in progress)');
                return;
            }
            console.log('📢 Real-time update: schedule changed', payload.eventType);
            await loadSchedule();
            renderCalendar();
            updateStats();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Schedule subscription active');
            }
        });

    // Subscribe to app_settings changes
    realtimeChannels.appSettings = supabase
        .channel('app_settings_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, async (payload) => {
            // Skip if we're currently saving to prevent loops
            if (isSaving) {
                console.log('⏭️ Skipping real-time update (save in progress)');
                return;
            }
            // Skip if the change is to currentWeekStart (we don't sync that)
            if (payload.new && payload.new.key === 'currentWeekStart') {
                console.log('⏭️ Skipping currentWeekStart sync (local only)');
                return;
            }
            if (payload.old && payload.old.key === 'currentWeekStart') {
                console.log('⏭️ Skipping currentWeekStart sync (local only)');
                return;
            }
            console.log('📢 Real-time update: app_settings changed', payload.eventType);
            // Store current week before loading (to preserve local navigation)
            const savedWeek = currentWeekStart;
            await loadAppSettings();
            // Restore local week navigation (don't let Supabase override it)
            currentWeekStart = savedWeek;
            renderCalendar();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ App settings subscription active');
            }
        });
    
    console.log('✅ Real-time subscriptions set up');
}

// Load all members from Supabase (one list: team_members with is_leadership column).
// Splits into teamMembers (production) and leadershipMembers for the UI.
async function loadTeamMembers(skipDefaults = false) {
    if (typeof supabase === 'undefined') {
        console.warn('Supabase not available, using localStorage');
        const savedMembers = localStorage.getItem('teamMembers');
        const savedLeadership = localStorage.getItem('leadershipMembers');
        if (savedMembers) teamMembers = JSON.parse(savedMembers);
        else teamMembers = [
            { name: 'Kendall', color: '#ce2828', profilePicture: '', hourlyRate: 30 },
            { name: 'Connor', color: '#50c878', profilePicture: '', hourlyRate: 28 },
            { name: 'Chaewon', color: '#4a90e2', profilePicture: '', hourlyRate: 29 },
            { name: 'Game Time', color: '#e2a84a', profilePicture: '', hourlyRate: null }
        ];
        if (savedLeadership) leadershipMembers = JSON.parse(savedLeadership);
        else leadershipMembers = [
            { name: 'Sam', color: '#e2a84a', profilePicture: '', hourlyRate: 49 },
            { name: 'Will', color: '#9b59b6', profilePicture: '', hourlyRate: 49 }
        ];
        return;
    }

    try {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .order('name');

        if (error) throw error;

        if (data && data.length > 0) {
            const base = (m) => ({
                name: m.name,
                color: m.color,
                profilePicture: m.profile_picture || '',
                hourlyRate: m.hourly_rate != null ? Number(m.hourly_rate) : null
            });
            teamMembers = data.filter(m => !m.is_leadership).map(base);
            leadershipMembers = data.filter(m => m.is_leadership).map(base);
            // #region agent log
            var _lead = leadershipMembers.slice(0, 3).map(m => ({ name: m.name, hourlyRate: m.hourlyRate }));
            fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:loadTeamMembers',message:'from Supabase',data:{leadershipSample:_lead},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
            // #endregion
            // One-time: if production members are wrong (old defaults or all 5 in production), restore correct split
            const oldDefaultNames = ['John Doe', 'Jane Smith', 'Bob Johnson'];
            const currentProdNames = teamMembers.map(m => m.name).sort().join(',');
            const oldNames = oldDefaultNames.slice().sort().join(',');
            const hasWrongProduction = (teamMembers.length === 3 && currentProdNames === oldNames) ||
                (teamMembers.length === 5 && teamMembers.every(m => ['Kendall','Chaewon','Connor','Sam','Will'].includes(m.name)));
            if (hasWrongProduction) {
                const nameMap = { 'John Doe': 'Kendall', 'Jane Smith': 'Chaewon', 'Bob Johnson': 'Connor' };
                teamMembers = [
                    { name: 'Kendall', color: '#ce2828', profilePicture: '', hourlyRate: 30 },
                    { name: 'Connor', color: '#50c878', profilePicture: '', hourlyRate: 28 },
                    { name: 'Chaewon', color: '#4a90e2', profilePicture: '', hourlyRate: 29 },
                    { name: 'Game Time', color: '#e2a84a', profilePicture: '', hourlyRate: null }
                ];
                const defaultLeadership = [
                    { name: 'Sam', color: '#e2a84a', profilePicture: '', hourlyRate: 49 },
                    { name: 'Will', color: '#9b59b6', profilePicture: '', hourlyRate: 49 }
                ];
                leadershipMembers = defaultLeadership.map(def => {
                    const existing = leadershipMembers.find(m => m.name === def.name);
                    return existing ? { ...def, profilePicture: existing.profilePicture || def.profilePicture, color: existing.color || def.color, hourlyRate: existing.hourlyRate != null ? existing.hourlyRate : def.hourlyRate } : def;
                });
                Object.keys(schedule).forEach(key => {
                    if (Array.isArray(schedule[key])) {
                        schedule[key].forEach(a => {
                            if (a && a.member && nameMap[a.member]) a.member = nameMap[a.member];
                        });
                    }
                });
                console.log('📥 Restored production: Kendall, Connor, Chaewon, Game Time; leadership: Sam, Will');
                if (!isSaving) {
                    isSaving = true;
                    saveTeamMembers().catch(err => console.error('Failed to save team members:', err)).finally(() => { isSaving = false; });
                    saveSchedule().catch(err => console.error('Failed to save schedule:', err));
                }
            }
        } else {
            // Supabase has no team members: try localStorage backup before defaults
            const savedMembers = localStorage.getItem('teamMembers');
            const savedLeadership = localStorage.getItem('leadershipMembers');
            if (savedMembers) {
                try {
                    const parsed = JSON.parse(savedMembers);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        teamMembers = parsed;
                        console.log('📥 Restored', teamMembers.length, 'production members from localStorage backup');
                    }
                } catch (_) {}
            }
            if (savedLeadership) {
                try {
                    const parsed = JSON.parse(savedLeadership);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        leadershipMembers = parsed;
                        // #region agent log
                        var _lead = leadershipMembers.slice(0, 3).map(m => ({ name: m.name, hourlyRate: m.hourlyRate }));
                        fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:loadTeamMembers',message:'from localStorage backup',data:{leadershipSample:_lead},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
                        // #endregion
                        console.log('📥 Restored', leadershipMembers.length, 'leadership members from localStorage backup');
                    }
                } catch (_) {}
            }
            if (teamMembers.length === 0 && !skipDefaults) {
                console.log('No team members found, creating defaults...');
                teamMembers = [
                    { name: 'Kendall', color: '#ce2828', profilePicture: '', hourlyRate: 30 },
                    { name: 'Connor', color: '#50c878', profilePicture: '', hourlyRate: 28 },
                    { name: 'Chaewon', color: '#4a90e2', profilePicture: '', hourlyRate: 29 },
                    { name: 'Game Time', color: '#e2a84a', profilePicture: '', hourlyRate: null }
                ];
                leadershipMembers = leadershipMembers.length ? leadershipMembers : [
                    { name: 'Sam', color: '#e2a84a', profilePicture: '', hourlyRate: 49 },
                    { name: 'Will', color: '#9b59b6', profilePicture: '', hourlyRate: 49 }
                ];
                if (!isSaving) {
                    isSaving = true;
                    saveTeamMembers().catch(err => console.error('Failed to save default team members:', err)).finally(() => { isSaving = false; });
                }
            } else if (teamMembers.length > 0 || leadershipMembers.length > 0) {
                if (!isSaving) {
                    isSaving = true;
                    saveTeamMembers().catch(err => console.error('Failed to re-save restored team members to Supabase:', err)).finally(() => { isSaving = false; });
                }
            }
        }
    } catch (error) {
        console.error('Error loading team members:', error);
        const savedMembers = localStorage.getItem('teamMembers');
        const savedLeadership = localStorage.getItem('leadershipMembers');
        if (savedMembers) teamMembers = JSON.parse(savedMembers);
        else teamMembers = [
            { name: 'Kendall', color: '#ce2828', profilePicture: '', hourlyRate: 30 },
            { name: 'Connor', color: '#50c878', profilePicture: '', hourlyRate: 28 },
            { name: 'Chaewon', color: '#4a90e2', profilePicture: '', hourlyRate: 29 },
            { name: 'Game Time', color: '#e2a84a', profilePicture: '', hourlyRate: null }
        ];
        if (savedLeadership) leadershipMembers = JSON.parse(savedLeadership);
        else {
            const defaultLeadership = [
                { name: 'Sam', color: '#e2a84a', profilePicture: '', hourlyRate: 49 },
                { name: 'Will', color: '#9b59b6', profilePicture: '', hourlyRate: 49 }
            ];
            leadershipMembers = defaultLeadership.map(def => {
                const existing = leadershipMembers.find(m => m.name === def.name);
                return existing ? { ...def, profilePicture: existing.profilePicture || def.profilePicture, color: existing.color || def.color, hourlyRate: existing.hourlyRate != null ? existing.hourlyRate : def.hourlyRate } : def;
            });
        }
    }
}

// Load clients from Supabase
async function loadClients(skipDefaults = false) {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.warn('Supabase not available, using localStorage');
        const savedClients = localStorage.getItem('clients');
        if (savedClients) {
            clients = JSON.parse(savedClients);
        } else {
            clients = [
                { name: 'Client A', color: '#667eea' },
                { name: 'Client B', color: '#764ba2' },
                { name: 'Client C', color: '#f093fb' }
            ];
        }
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('name');

        if (error) {
            console.error('Supabase error loading clients:', error);
            throw error;
        }

        if (data && data.length > 0) {
            clients = data.map(c => ({
                name: c.name,
                color: c.color
            }));
        } else {
            // Supabase has no clients: try localStorage backup before defaults
            const savedClients = localStorage.getItem('clients');
            if (savedClients) {
                try {
                    const parsed = JSON.parse(savedClients);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        clients = parsed;
                        console.log('📥 Restored', clients.length, 'clients from localStorage backup');
                        if (!isSaving) {
                            isSaving = true;
                            saveClients().catch(err => console.error('Failed to re-save restored clients to Supabase:', err)).finally(() => { isSaving = false; });
                        }
                    }
                } catch (_) {}
            }
            if (clients.length === 0 && !skipDefaults) {
                console.log('No clients found, creating defaults...');
                clients = [
                    { name: 'Client A', color: '#667eea' },
                    { name: 'Client B', color: '#764ba2' },
                    { name: 'Client C', color: '#f093fb' }
                ];
                if (!isSaving) {
                    isSaving = true;
                    saveClients().catch(err => console.error('Failed to save default clients:', err)).finally(() => {
                        isSaving = false;
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        // Fallback to localStorage
        const savedClients = localStorage.getItem('clients');
        if (savedClients) {
            clients = JSON.parse(savedClients);
        } else {
            // If no localStorage data, use defaults
            clients = [
                { name: 'Client A', color: '#667eea' },
                { name: 'Client B', color: '#764ba2' },
                { name: 'Client C', color: '#f093fb' }
            ];
        }
    }
}

// Load projects from Supabase (projects belong to clients; have name and budget).
async function loadProjects() {
    if (typeof supabase === 'undefined') {
        const saved = localStorage.getItem('projects');
        if (saved) {
            try {
                projects = JSON.parse(saved);
            } catch (_) {
                projects = [];
            }
        } else {
            projects = [];
        }
        return;
    }
    try {
        const { data, error } = await supabase.from('projects').select('*').order('client_name').order('name');
        if (error) throw error;
        if (data && data.length > 0) {
            projects = data.map(p => ({
                id: p.id,
                clientName: p.client_name,
                name: p.name,
                budget: p.budget != null ? Number(p.budget) : null,
                color: (p.color || '#667eea')
            }));
        } else {
            const saved = localStorage.getItem('projects');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) projects = parsed;
                } catch (_) {}
            }
            if (projects.length === 0) projects = [];
        }
        try {
            localStorage.setItem('projects', JSON.stringify(projects));
        } catch (_) {}
    } catch (err) {
        console.error('Error loading projects:', err);
        const saved = localStorage.getItem('projects');
        if (saved) {
            try {
                projects = JSON.parse(saved);
            } catch (_) {
                projects = [];
            }
        } else {
            projects = [];
        }
    }
}

// Save projects to Supabase.
async function saveProjects() {
    if (typeof supabase === 'undefined') {
        localStorage.setItem('projects', JSON.stringify(projects));
        return;
    }
    try {
        const { data: existing } = await supabase.from('projects').select('id');
        if (existing && existing.length > 0) {
            const ids = existing.map(p => p.id);
            const { error: delErr } = await supabase.from('projects').delete().in('id', ids);
            if (delErr) throw delErr;
        }
        if (projects.length > 0) {
            const rows = projects.map(p => ({
                client_name: p.clientName,
                name: p.name,
                budget: p.budget != null ? Number(p.budget) : null,
                color: p.color || '#667eea'
            }));
            const { error } = await supabase.from('projects').insert(rows);
            if (error) throw error;
        }
        localStorage.setItem('projects', JSON.stringify(projects));
    } catch (err) {
        console.error('Error saving projects:', err);
        localStorage.setItem('projects', JSON.stringify(projects));
    }
}

// Split loaded schedule into production (schedule) and leadership (leadershipSchedule)
function splitScheduleAfterLoad(raw) {
    schedule = {};
    leadershipSchedule = {};
    if (!raw || typeof raw !== 'object') return;
    Object.keys(raw).forEach(key => {
        let arr = raw[key];
        if (!Array.isArray(arr)) arr = arr != null ? [arr] : [];
        arr = arr.filter(a => a && typeof a === 'object');
        const normalizedKey = normalizeProductionBlockKey(key);
        if (isLeadershipBlockKey(normalizedKey)) {
            leadershipSchedule[normalizedKey] = arr;
        } else {
            schedule[normalizedKey] = arr;
        }
    });
}

// Load schedule from Supabase
async function loadSchedule() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.warn('Supabase not available, using localStorage');
        const savedSchedule = localStorage.getItem('schedule');
        const savedLeadership = localStorage.getItem('leadershipSchedule');
        if (savedSchedule) {
            const raw = JSON.parse(savedSchedule);
            Object.keys(raw).forEach(key => {
                if (raw[key] && !Array.isArray(raw[key])) raw[key] = [raw[key]];
            });
            splitScheduleAfterLoad(raw);
        } else {
            schedule = {};
            leadershipSchedule = {};
        }
        if (savedLeadership) {
            const lead = JSON.parse(savedLeadership);
            Object.assign(leadershipSchedule, lead);
        }
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('schedule')
            .select('*');

        if (error) throw error;

        const raw = {};
        if (data && data.length > 0) {
            data.forEach(row => {
                const key = row && row.block_key != null ? String(row.block_key) : null;
                if (!key) return;
                let val = row.assignments;
                if (typeof val === 'string') {
                    try { val = JSON.parse(val); } catch (_) { val = []; }
                }
                if (!Array.isArray(val)) val = val ? [val] : [];
                raw[key] = val;
            });
        }
        // If Supabase has no schedule data, try to restore from localStorage backup
        if (Object.keys(raw).length === 0) {
            const savedSchedule = localStorage.getItem('schedule');
            const savedLeadership = localStorage.getItem('leadershipSchedule');
            if (savedSchedule) {
                try {
                    const parsed = JSON.parse(savedSchedule);
                    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                        Object.assign(raw, parsed);
                        console.log('📥 Restored schedule from localStorage backup (' + Object.keys(parsed).length + ' block keys)');
                    }
                } catch (_) {}
            }
            if (savedLeadership) {
                try {
                    const parsed = JSON.parse(savedLeadership);
                    if (parsed && typeof parsed === 'object') {
                        Object.keys(parsed).forEach(k => { raw[k] = parsed[k]; });
                        console.log('📥 Restored leadership schedule from localStorage backup');
                    }
                } catch (_) {}
            }
        }
        Object.keys(raw).forEach(key => {
            if (raw[key] && !Array.isArray(raw[key])) raw[key] = [raw[key]];
        });
        splitScheduleAfterLoad(raw);
        // If we restored from localStorage, push back to Supabase so data is not lost again
        if (Object.keys(raw).length > 0 && data && data.length === 0) {
            saveSchedule().catch(err => console.error('Failed to re-save restored schedule to Supabase:', err));
        }
    } catch (error) {
        console.error('Error loading schedule:', error);
        const savedSchedule = localStorage.getItem('schedule');
        if (savedSchedule) {
            const raw = JSON.parse(savedSchedule);
            Object.keys(raw).forEach(key => {
                if (raw[key] && !Array.isArray(raw[key])) raw[key] = [raw[key]];
            });
            splitScheduleAfterLoad(raw);
        } else {
            schedule = {};
            leadershipSchedule = {};
        }
    }
}

// Load app settings from Supabase
async function loadAppSettings() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.warn('Supabase not available, using localStorage');
        const savedTimeBlocks = localStorage.getItem('timeBlocks');
        if (savedTimeBlocks) {
            const raw = JSON.parse(savedTimeBlocks);
            timeBlocks = Array.isArray(raw) ? raw.filter(b => b && !b.id.startsWith('leadership-')) : [];
        } else {
            timeBlocks = [
                { id: 'Work1', label: 'Work Block 1', time: '11:00 AM - 1:00 PM', startTime: '11:00', endTime: '13:00', isLunch: false },
                { id: 'Lunch', label: 'Lunch', time: '1:00 PM - 2:00 PM', startTime: '13:00', endTime: '14:00', isLunch: true },
                { id: 'Work2', label: 'Work Block 2', time: '2:00 PM - 4:00 PM', startTime: '14:00', endTime: '16:00', isLunch: false },
                { id: 'Work3', label: 'Work Block 3', time: '4:00 PM - 6:00 PM', startTime: '16:00', endTime: '18:00', isLunch: false }
            ];
        }

        const loaded = loadCurrentWeekStartFromLocalStorage();
        if (loaded) {
            currentWeekStart = loaded;
        } else {
            currentWeekStart = getMondayForDate(new Date());
            saveCurrentWeekStartToLocalStorage(currentWeekStart);
        }

        const savedTheme = localStorage.getItem('isDarkTheme');
        if (savedTheme !== null) {
            isDarkTheme = savedTheme === 'true';
        }
        const savedClientDetails = localStorage.getItem('clientDetails');
        if (savedClientDetails) {
            clientDetails = JSON.parse(savedClientDetails);
        }
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*');

        if (error) throw error;

        if (data) {
            data.forEach(setting => {
                if (setting.key === 'timeBlocks') {
                    const raw = setting.value || [];
                    timeBlocks = Array.isArray(raw) ? raw.filter(b => b && !b.id.startsWith('leadership-')) : [];
                } else if (setting.key === 'isDarkTheme') {
                    isDarkTheme = setting.value;
                } else if (setting.key === 'clientDetails') {
                    clientDetails = setting.value || {};
                }
                // Note: currentWeekStart is NOT loaded from Supabase - it stays local per device
            });
        }

        // Load currentWeekStart from localStorage only (never from Supabase)
        const loaded = loadCurrentWeekStartFromLocalStorage();
        if (loaded) {
            currentWeekStart = loaded;
        } else {
            currentWeekStart = getMondayForDate(new Date());
            // Save to localStorage only
            saveCurrentWeekStartToLocalStorage(currentWeekStart);
        }

        // Set defaults if not found
        if (!timeBlocks || timeBlocks.length === 0) {
            timeBlocks = [
                { id: 'Work1', label: 'Work Block 1', time: '11:00 AM - 1:00 PM', startTime: '11:00', endTime: '13:00', isLunch: false },
                { id: 'Lunch', label: 'Lunch', time: '1:00 PM - 2:00 PM', startTime: '13:00', endTime: '14:00', isLunch: true },
                { id: 'Work2', label: 'Work Block 2', time: '2:00 PM - 4:00 PM', startTime: '14:00', endTime: '16:00', isLunch: false },
                { id: 'Work3', label: 'Work Block 3', time: '4:00 PM - 6:00 PM', startTime: '16:00', endTime: '18:00', isLunch: false }
            ];
            // Save defaults to database (don't await - let it happen in background)
            saveAppSettings().catch(err => console.error('Failed to save default time blocks:', err));
        }
    } catch (error) {
        console.error('Error loading app settings:', error);
        const savedTimeBlocks = localStorage.getItem('timeBlocks');
        if (savedTimeBlocks) {
            const raw = JSON.parse(savedTimeBlocks);
            timeBlocks = Array.isArray(raw) ? raw.filter(b => b && !b.id.startsWith('leadership-')) : [];
        } else {
            timeBlocks = [
                { id: 'Work1', label: 'Work Block 1', time: '11:00 AM - 1:00 PM', startTime: '11:00', endTime: '13:00', isLunch: false },
                { id: 'Lunch', label: 'Lunch', time: '1:00 PM - 2:00 PM', startTime: '13:00', endTime: '14:00', isLunch: true },
                { id: 'Work2', label: 'Work Block 2', time: '2:00 PM - 4:00 PM', startTime: '14:00', endTime: '16:00', isLunch: false },
                { id: 'Work3', label: 'Work Block 3', time: '4:00 PM - 6:00 PM', startTime: '16:00', endTime: '18:00', isLunch: false }
            ];
        }

        const loaded = loadCurrentWeekStartFromLocalStorage();
        if (loaded) {
            currentWeekStart = loaded;
        } else {
            currentWeekStart = getMondayForDate(new Date());
            saveCurrentWeekStartToLocalStorage(currentWeekStart);
        }

        const savedTheme = localStorage.getItem('isDarkTheme');
        if (savedTheme !== null) {
            isDarkTheme = savedTheme === 'true';
        }
        const savedClientDetails = localStorage.getItem('clientDetails');
        if (savedClientDetails) {
            clientDetails = JSON.parse(savedClientDetails);
        }
    }
}

// Load data from Supabase (with localStorage fallback)
async function loadData() {
    console.log('📥 Loading data from Supabase...');
    console.log('Supabase available:', typeof supabase !== 'undefined');
    
    await loadTeamMembers();
    console.log('Loaded team members:', teamMembers.length, 'leadership:', leadershipMembers.length);

    await loadClients();
    console.log('Loaded clients:', clients.length);

    await loadProjects();
    console.log('Loaded projects:', projects.length);

    // Seed projects from clients if empty (default: project name = client name)
    if (projects.length === 0 && clients.length > 0) {
        projects = clients.map(c => ({ name: c.name, clientName: c.name, color: c.color, budget: null }));
        await saveProjects();
        console.log('Seeded projects from clients');
    }
    // Derive clients from projects for sidebar/calendar/assignments
    if (projects.length > 0) {
        clients = getDerivedClientsFromProjects();
    }
    
    await loadSchedule();
    console.log('Loaded schedule entries:', Object.keys(schedule).length);
    
    await loadAppSettings();
    console.log('Loaded time blocks:', timeBlocks.length);

    // After schedule + time blocks are loaded, try to repair legacy UTC-shifted week keys for the currently viewed week.
    // This is safe and only affects the visible week (Mon–Fri).
    const migrated = migrateScheduleKeysForViewedWeekIfNeeded();
    if (migrated) {
        console.log('✅ Fixed shifted schedule keys for viewed week');
    }
    
    await loadWeeklyTimeTracking();

    // Load admin mode state - persists across browser sessions per device (localStorage only)
    const savedAdminMode = localStorage.getItem('isAdminMode');
    if (savedAdminMode !== null) {
        isAdminMode = savedAdminMode === 'true';
    } else {
        isAdminMode = false;
    }
    
    applyTheme();
    updateModeIndicator();
    applyViewModeRestrictions();
    applyAdminModeClass();
    
    console.log('✅ Data loading complete');
}

// Save state to history for undo
function saveStateToHistory() {
    const state = {
        teamMembers: JSON.parse(JSON.stringify(teamMembers)),
        clients: JSON.parse(JSON.stringify(clients)),
        schedule: JSON.parse(JSON.stringify(schedule)),
        leadershipSchedule: JSON.parse(JSON.stringify(leadershipSchedule)),
        timeBlocks: JSON.parse(JSON.stringify(timeBlocks))
    };
    undoHistory.push(state);
    if (undoHistory.length > maxHistorySize) {
        undoHistory.shift();
    }
}

// Undo last action
function undo() {
    if (undoHistory.length > 0) {
        const previousState = undoHistory.pop();
        teamMembers = previousState.teamMembers;
        clients = previousState.clients;
        schedule = previousState.schedule;
        if (previousState.leadershipSchedule) {
            leadershipSchedule = previousState.leadershipSchedule;
        }
        if (previousState.timeBlocks) {
            timeBlocks = previousState.timeBlocks;
        }
        saveData();
        renderSidebar();
        renderSettings();
        renderCalendar();
        updateStats();
        if (isLeadershipMode) renderAllLeadershipTimeEntries();
    }
}

// Save all members (production + leadership) to Supabase team_members table with is_leadership flag.
async function saveTeamMembers() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:saveTeamMembers',message:'start',data:{leadershipRates:leadershipMembers.map(m=>m.hourlyRate),hasSupabase:typeof supabase!=='undefined'},timestamp:Date.now(),hypothesisId:'H8'})}).catch(()=>{});
    // #endregion
    if (typeof supabase === 'undefined') {
        localStorage.setItem('teamMembers', JSON.stringify(teamMembers));
        localStorage.setItem('leadershipMembers', JSON.stringify(leadershipMembers));
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:saveTeamMembers',message:'no Supabase, localStorage only',data:{leadershipRates:leadershipMembers.map(m=>m.hourlyRate)},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        return;
    }

    try {
        const { data: existing, error: selectError } = await supabase.from('team_members').select('id');
        if (selectError) throw selectError;

        if (existing && existing.length > 0) {
            const idsToDelete = existing.map(m => m.id);
            const { error: deleteError } = await supabase.from('team_members').delete().in('id', idsToDelete);
            if (deleteError) throw deleteError;
        }

        const productionRows = teamMembers.map(m => ({
            name: m.name,
            color: m.color,
            profile_picture: m.profilePicture || '',
            hourly_rate: m.hourlyRate != null && m.hourlyRate !== '' ? Number(m.hourlyRate) : null,
            is_leadership: false
        }));
        const leadershipRows = leadershipMembers.map(m => ({
            name: m.name,
            color: m.color,
            profile_picture: m.profilePicture || '',
            hourly_rate: m.hourlyRate != null && m.hourlyRate !== '' ? Number(m.hourlyRate) : null,
            is_leadership: true
        }));
        const allRows = [...productionRows, ...leadershipRows];

        if (allRows.length > 0) {
            const { error } = await supabase.from('team_members').insert(allRows);
            if (error) throw error;
            console.log('✅ Saved', teamMembers.length, 'production +', leadershipMembers.length, 'leadership members to Supabase');
        }
        try {
            localStorage.setItem('teamMembers', JSON.stringify(teamMembers));
            localStorage.setItem('leadershipMembers', JSON.stringify(leadershipMembers));
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:saveTeamMembers',message:'after Supabase+localStorage',data:{leadershipRates:leadershipMembers.map(m=>m.hourlyRate)},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
            // #endregion
        } catch (_) {}
    } catch (error) {
        console.error('Error saving team members:', error);
        localStorage.setItem('teamMembers', JSON.stringify(teamMembers));
        localStorage.setItem('leadershipMembers', JSON.stringify(leadershipMembers));
    }
}

// Save clients to Supabase
async function saveClients() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        localStorage.setItem('clients', JSON.stringify(clients));
        return;
    }
    
    try {
        // Get all existing clients first
        const { data: existing } = await supabase.from('clients').select('id');
        
        // Delete all existing clients if any
        if (existing && existing.length > 0) {
            const idsToDelete = existing.map(c => c.id);
            const { error: deleteError } = await supabase
                .from('clients')
                .delete()
                .in('id', idsToDelete);
            if (deleteError) throw deleteError;
        }
        
        // Insert all current clients
        if (clients.length > 0) {
            const clientsToInsert = clients.map(c => ({
                name: c.name,
                color: c.color
            }));
            
            const { error } = await supabase
                .from('clients')
                .insert(clientsToInsert);
            
            if (error) throw error;
        }
        try {
            localStorage.setItem('clients', JSON.stringify(clients));
        } catch (_) {}
    } catch (error) {
        console.error('Error saving clients:', error);
        localStorage.setItem('clients', JSON.stringify(clients));
    }
}

// Save schedule to Supabase
async function saveSchedule() {
    if (typeof supabase === 'undefined') {
        localStorage.setItem('schedule', JSON.stringify(schedule));
        localStorage.setItem('leadershipSchedule', JSON.stringify(leadershipSchedule));
        return;
    }
    
    try {
        // Persist both production (schedule) and leadership (leadershipSchedule) in one table
        const allKeys = [...Object.keys(schedule), ...Object.keys(leadershipSchedule)];
        const scheduleEntries = allKeys.map(blockKey => ({
            block_key: blockKey,
            assignments: isLeadershipBlockKey(blockKey) ? leadershipSchedule[blockKey] : schedule[blockKey]
        }));

        const { data: existing } = await supabase.from('schedule').select('id');
        if (existing && existing.length > 0) {
            const idsToDelete = existing.map(s => s.id);
            const { error: deleteError } = await supabase
                .from('schedule')
                .delete()
                .in('id', idsToDelete);
            if (deleteError) throw deleteError;
        }

        if (scheduleEntries.length > 0) {
            const { error } = await supabase
                .from('schedule')
                .insert(scheduleEntries);
            if (error) throw error;
        }
        // Always keep localStorage as backup so we can restore if Supabase is ever empty
        try {
            localStorage.setItem('schedule', JSON.stringify(schedule));
            localStorage.setItem('leadershipSchedule', JSON.stringify(leadershipSchedule));
        } catch (_) {}
    } catch (error) {
        console.error('Error saving schedule:', error);
        localStorage.setItem('schedule', JSON.stringify(schedule));
        localStorage.setItem('leadershipSchedule', JSON.stringify(leadershipSchedule));
    }
}

// Load weekly time tracking from Supabase
async function loadWeeklyTimeTracking() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        const saved = localStorage.getItem('weeklyTimeTracking');
        if (saved) {
            weeklyTimeTracking = JSON.parse(saved);
        } else {
            weeklyTimeTracking = {};
        }
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('weekly_time_tracking')
            .select('*');

        if (error) throw error;

        weeklyTimeTracking = {};
        if (data && data.length > 0) {
            data.forEach(row => {
                if (!weeklyTimeTracking[row.week_key]) {
                    weeklyTimeTracking[row.week_key] = {};
                }
                if (!weeklyTimeTracking[row.week_key][row.member_name]) {
                    weeklyTimeTracking[row.week_key][row.member_name] = {};
                }
                weeklyTimeTracking[row.week_key][row.member_name][row.client_name] = row.hours;
            });
        }
    } catch (error) {
        console.error('Error loading weekly time tracking:', error);
        const saved = localStorage.getItem('weeklyTimeTracking');
        if (saved) {
            weeklyTimeTracking = JSON.parse(saved);
        } else {
            weeklyTimeTracking = {};
        }
    }
}

// Save weekly time tracking to Supabase
async function saveWeeklyTimeTracking() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        localStorage.setItem('weeklyTimeTracking', JSON.stringify(weeklyTimeTracking));
        return;
    }
    
    try {
        // Get all existing entries first
        const { data: existing } = await supabase.from('weekly_time_tracking').select('id, week_key, member_name, client_name');
        
        // Delete all existing entries if any
        if (existing && existing.length > 0) {
            const idsToDelete = existing.map(e => e.id);
            const { error: deleteError } = await supabase
                .from('weekly_time_tracking')
                .delete()
                .in('id', idsToDelete);
            if (deleteError) throw deleteError;
        }

        // Insert all current entries
        const entriesToInsert = [];
        Object.keys(weeklyTimeTracking).forEach(weekKey => {
            Object.keys(weeklyTimeTracking[weekKey]).forEach(memberName => {
                Object.keys(weeklyTimeTracking[weekKey][memberName]).forEach(clientName => {
                    const hours = weeklyTimeTracking[weekKey][memberName][clientName];
                    if (hours && hours > 0) {
                        entriesToInsert.push({
                            week_key: weekKey,
                            member_name: memberName,
                            client_name: clientName,
                            hours: hours
                        });
                    }
                });
            });
        });

        if (entriesToInsert.length > 0) {
            const { error } = await supabase
                .from('weekly_time_tracking')
                .insert(entriesToInsert);
            
            if (error) throw error;
        }
    } catch (error) {
        console.error('Error saving weekly time tracking:', error);
        localStorage.setItem('weeklyTimeTracking', JSON.stringify(weeklyTimeTracking));
    }
}

// Save app settings to Supabase
async function saveAppSettings() {
    try {
        // Save timeBlocks (production only; leadership never stored in app_settings)
        const productionTimeBlocks = (timeBlocks || []).filter(b => b && !b.id.startsWith('leadership-'));
        const settings = [
            { key: 'timeBlocks', value: productionTimeBlocks },
            { key: 'isDarkTheme', value: isDarkTheme },
            { key: 'clientDetails', value: clientDetails }
        ];

        for (const setting of settings) {
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key: setting.key, value: setting.value }, { onConflict: 'key' });
            
            if (error) throw error;
        }
    } catch (error) {
        console.error('Error saving app settings:', error);
        const productionTimeBlocks = (timeBlocks || []).filter(b => b && !b.id.startsWith('leadership-'));
        localStorage.setItem('timeBlocks', JSON.stringify(productionTimeBlocks));
        localStorage.setItem('isDarkTheme', isDarkTheme);
        localStorage.setItem('clientDetails', JSON.stringify(clientDetails));
    }
    
    // Always save currentWeekStart to localStorage only (never to Supabase)
    saveCurrentWeekStartToLocalStorage(currentWeekStart);
}

// Save data to Supabase (with localStorage fallback)
async function saveData() {
    // Prevent recursive saves
    if (isSaving) {
        console.log('⏭️ Save already in progress, skipping...');
        return;
    }
    
    isSaving = true;
    try {
        await saveTeamMembers();
        await saveClients();
        await saveProjects();
        await saveSchedule();
        await saveAppSettings();
        await saveWeeklyTimeTracking();
    } catch (error) {
        console.error('❌ Error saving data:', error);
    } finally {
        isSaving = false;
    }
    
    // Admin mode stays in localStorage (per device)
    localStorage.setItem('isAdminMode', isAdminMode);
}

// Initialize calendar
function initializeCalendar() {
    renderCalendar();
    updateWeekDisplay();
    updateDayHeaders();
}

// Update day headers to show day name + date number (Google Calendar style) and highlight today
function updateDayHeaders() {
    const dayHeaders = document.querySelectorAll('.day-header');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    dayHeaders.forEach((header, dayIndex) => {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIndex);
        dayDate.setHours(0, 0, 0, 0);
        const dayNum = dayDate.getDate();
        
        header.innerHTML = `<span class="day-header-name">${days[dayIndex]}</span><span class="day-header-num ${dayDate.getTime() === today.getTime() ? 'today-circle' : ''}"><span>${dayNum}</span></span>`;
        
        if (dayDate.getTime() === today.getTime()) {
            header.classList.add('today');
        } else {
            header.classList.remove('today');
        }
    });
}

// Render time column
function renderTimeColumn() {
    const timeColumn = document.querySelector('.time-column');
    if (!timeColumn) return;
    
    timeColumn.innerHTML = '';

    // Production calendar: only show production time blocks (exclude leadership hourly slots)
    timeBlocks.forEach((block, index) => {
        if (block.id.startsWith('leadership-')) return;
        const timeSlot = document.createElement('div');
        timeSlot.className = `time-slot ${block.isLunch ? 'lunch-slot' : ''}`;
        timeSlot.dataset.blockId = block.id;
        timeSlot.dataset.blockIndex = index;
        
        if (block.isLunch) {
            timeSlot.style.height = '70px';
        } else {
            timeSlot.style.height = '220px';
        }
        
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        timeDisplay.textContent = block.time;
        timeSlot.appendChild(timeDisplay);
        
        // Add edit and delete buttons on hover (not for lunch)
        if (!block.isLunch) {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'time-slot-buttons';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'time-edit-btn';
            editBtn.innerHTML = '✎';
            editBtn.title = 'Edit time';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                editTimeBlock(index);
            };
            buttonContainer.appendChild(editBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'time-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete time block';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteTimeBlock(index);
            };
            buttonContainer.appendChild(deleteBtn);
            
            timeSlot.appendChild(buttonContainer);
        }
        
        timeColumn.appendChild(timeSlot);
    });
    
    // Add "Add Block" button at the end
    const addBlockBtn = document.createElement('div');
    addBlockBtn.className = 'time-slot add-block-slot';
    addBlockBtn.innerHTML = '<button class="add-block-btn" onclick="showAddBlockModal()">+ Add Block</button>';
    timeColumn.appendChild(addBlockBtn);
}

// Render calendar
function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Render time column
    renderTimeColumn();
    
    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    days.forEach((day, dayIndex) => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';

        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIndex);
        dayDate.setHours(0, 0, 0, 0);
        
        // Check if this day is today
        const isToday = dayDate.getTime() === today.getTime();
        if (isToday) {
            dayColumn.classList.add('today');
        }
        
        const dateKey = formatDateKey(dayDate, day);

        timeBlocks.forEach((block, blockIndex) => {
            // Production calendar: do not show leadership-only blocks (hourly leadership slots)
            if (block.id.startsWith('leadership-')) return;

            const timeBlock = document.createElement('div');
            timeBlock.className = `time-block ${block.id === 'Lunch' ? 'lunch' : 'work-block'}`;
            
            if (block.id === 'Lunch') {
                timeBlock.textContent = 'Lunch';
            } else {
                const blockKey = `${dateKey}-${block.id}`;
                // Show all assignments in schedule; only hide leadership (they have their own board)
                const leadershipMemberNames = new Set(leadershipMembers.map(m => m.name));
                const rawList = schedule[blockKey] || [];
                const assignmentsWithIndex = rawList
                    .map((a, i) => ({ assignment: a, realIndex: i }))
                    .filter(({ assignment: a }) => a && !leadershipMemberNames.has(a.member));

                // Sort by member name (keep realIndex for remove/edit)
                const sortedAssignments = [...assignmentsWithIndex].sort((a, b) => {
                    const nameA = (a.assignment.member || '').toLowerCase();
                    const nameB = (b.assignment.member || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                // Create assignments container
                const assignmentsContainer = document.createElement('div');
                assignmentsContainer.className = 'assignments-container';

                sortedAssignments.forEach(({ assignment, realIndex }) => {
                    if (!assignment || typeof assignment !== 'object') return;
                    const originalIndex = realIndex;
                    const mem = assignment.member != null ? String(assignment.member) : '';
                    const cli = assignment.client != null ? String(assignment.client) : '';
                    
                    const member = teamMembers.find(m => m.name === mem);
                    const client = clients.find(c => c.name === cli);
                    const memberColor = member ? member.color : '#ce2828';
                    const clientColor = client ? client.color : '#667eea';
                    const profilePicture = member && member.profilePicture ? member.profilePicture : '';
                    const memberInitial = mem ? mem.charAt(0).toUpperCase() : '?';

                    const assignmentDiv = document.createElement('div');
                    assignmentDiv.className = 'assignment';
                    assignmentDiv.draggable = isAdminMode;
                    assignmentDiv.dataset.sourceBlock = blockKey;
                    assignmentDiv.dataset.assignmentIndex = originalIndex;
                    const memberTextColor = getContrastTextColor(memberColor);
                    const clientTextColor = getContrastTextColor(clientColor);
                    assignmentDiv.innerHTML = `
                        <div class="assignment-container">
                            <div class="assignment-member-section" style="background-color: ${memberColor}; color: ${memberTextColor};">
                                <div class="assignment-member-circle">
                                    ${profilePicture ? 
                                        `<img src="${profilePicture}" alt="${mem}" class="assignment-profile-picture">` : 
                                        `<span class="assignment-member-initial" style="color: ${memberTextColor};">${memberInitial}</span>`
                                    }
                                </div>
                                <div class="assignment-member-box">
                                    <span class="assignment-member-name" style="color: ${memberTextColor};">${mem}</span>
                                </div>
                            </div>
                            <div class="assignment-client-box" style="background-color: ${clientColor};">
                                <span class="assignment-client-name" style="color: ${clientTextColor};">${cli}</span>
                                ${isAdminMode ? `<button class="assignment-remove" onclick="removeAssignment('${blockKey}', ${originalIndex})">×</button>` : ''}
                            </div>
                        </div>
                    `;
                    
                    // Add click handler to edit client (only in admin mode)
                    if (isAdminMode) {
                        assignmentDiv.style.cursor = 'pointer';
                        assignmentDiv.addEventListener('click', (e) => {
                            // Don't trigger if clicking the remove button
                            if (e.target.classList.contains('assignment-remove')) {
                                return;
                            }
                            editAssignmentClient(blockKey, originalIndex, assignment);
                        });
                    }
                    
                    // Add drag event listeners (only in admin mode)
                    if (isAdminMode) {
                        assignmentDiv.addEventListener('dragstart', (e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                                sourceBlock: blockKey,
                                assignmentIndex: originalIndex,
                                assignment: assignment
                            }));
                            assignmentDiv.classList.add('dragging-assignment');
                            window.draggingAssignment = true;
                        });
                        
                        assignmentDiv.addEventListener('dragend', () => {
                            assignmentDiv.classList.remove('dragging-assignment');
                            window.draggingAssignment = false;
                        });
                        
                        // Add click handler to edit client (only in admin mode)
                        assignmentDiv.style.cursor = 'pointer';
                        assignmentDiv.addEventListener('click', (e) => {
                            // Don't trigger if clicking the remove button
                            if (e.target.classList.contains('assignment-remove')) {
                                return;
                            }
                            editAssignmentClient(blockKey, originalIndex, assignment);
                        });
                    }
                    
                    assignmentsContainer.appendChild(assignmentDiv);
                });

                timeBlock.appendChild(assignmentsContainer);

                // Add click handler to blocks (only in admin mode)
                if (isAdminMode) {
                    timeBlock.style.cursor = 'pointer';
                    timeBlock.classList.add('empty-block-clickable');
                    timeBlock.addEventListener('click', (e) => {
                        // Don't trigger if clicking on buttons or assignments
                        if (e.target.classList.contains('block-clear-btn') || 
                            e.target.closest('.assignment') ||
                            e.target.closest('.block-clear-buttons')) {
                            return;
                        }
                        showMemberModal(blockKey);
                    });
                }

                // Add clear buttons
                const clearBtnContainer = document.createElement('div');
                clearBtnContainer.className = 'block-clear-buttons';
                
                // Clear this block button (use assignmentsWithIndex - same list we rendered)
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:clearBlockCheck',message:'assignmentsWithIndex in scope',data:{blockKey,count:assignmentsWithIndex.length,hasAssignments:assignmentsWithIndex.length>0},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
                // #endregion
                if (assignmentsWithIndex.length > 0) {
                    const clearBtn = document.createElement('button');
                    clearBtn.className = 'block-clear-btn';
                    clearBtn.innerHTML = 'Clear Block';
                    clearBtn.title = 'Clear all assignments in this block';
                    clearBtn.onclick = (e) => {
                        if (!isAdminMode) return;
                        e.stopPropagation();
                        saveStateToHistory();
                        delete schedule[blockKey];
                        saveData();
                        renderCalendar();
                        updateStats();
                    };
                    
                    // Add hover effects to highlight the block red
                    clearBtn.addEventListener('mouseenter', () => {
                        timeBlock.classList.add('highlight-clear-block');
                    });
                    clearBtn.addEventListener('mouseleave', () => {
                        timeBlock.classList.remove('highlight-clear-block');
                    });
                    
                    clearBtnContainer.appendChild(clearBtn);
                }
                
                // Check if there are assignments in horizontal line (all days for this time block)
                const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                let hasHorizontalAssignments = false;
                days.forEach((dayName, dayIdx) => {
                    const dayDate = new Date(currentWeekStart);
                    dayDate.setDate(currentWeekStart.getDate() + dayIdx);
                    const dayDateKey = formatDateKey(dayDate, dayName);
                    const dayBlockKey = `${dayDateKey}-${block.id}`;
                    if (schedule[dayBlockKey] && schedule[dayBlockKey].length > 0) {
                        hasHorizontalAssignments = true;
                    }
                });
                
                // Clear horizontal line (all days for this time block)
                if (hasHorizontalAssignments) {
                    const clearHorizontalBtn = document.createElement('button');
                    clearHorizontalBtn.className = 'block-clear-btn clear-horizontal-btn';
                    clearHorizontalBtn.innerHTML = 'Clear Time';
                    clearHorizontalBtn.title = 'Clear all assignments for this time block across all days';
                    clearHorizontalBtn.dataset.blockId = block.id;
                    clearHorizontalBtn.onclick = (e) => {
                        if (!isAdminMode) return;
                        e.stopPropagation();
                        saveStateToHistory();
                        days.forEach((dayName, dayIdx) => {
                            const dayDate = new Date(currentWeekStart);
                            dayDate.setDate(currentWeekStart.getDate() + dayIdx);
                            const dayDateKey = formatDateKey(dayDate, dayName);
                            const dayBlockKey = `${dayDateKey}-${block.id}`;
                            delete schedule[dayBlockKey];
                        });
                        saveData();
                        renderCalendar();
                        updateStats();
                    };
                    
                    // Add hover effects for highlighting
                    clearHorizontalBtn.addEventListener('mouseenter', () => {
                        highlightHorizontalBlocks(block.id);
                    });
                    clearHorizontalBtn.addEventListener('mouseleave', () => {
                        clearHighlights();
                    });
                    
                    clearBtnContainer.appendChild(clearHorizontalBtn);
                }
                
                // Check if there are assignments in vertical line (all time blocks for this day)
                const workBlocks = ['Work1', 'Work2', 'Work3'];
                let hasVerticalAssignments = false;
                workBlocks.forEach(workBlockId => {
                    const dayBlockKey = `${dateKey}-${workBlockId}`;
                    if (schedule[dayBlockKey] && schedule[dayBlockKey].length > 0) {
                        hasVerticalAssignments = true;
                    }
                });
                
                // Clear vertical line (all time blocks for this day)
                if (hasVerticalAssignments) {
                    const clearVerticalBtn = document.createElement('button');
                    clearVerticalBtn.className = 'block-clear-btn clear-vertical-btn';
                    clearVerticalBtn.innerHTML = 'Clear Day';
                    clearVerticalBtn.title = 'Clear all assignments for this day';
                    clearVerticalBtn.dataset.dateKey = dateKey;
                    clearVerticalBtn.onclick = (e) => {
                        if (!isAdminMode) return;
                        e.stopPropagation();
                        saveStateToHistory();
                        workBlocks.forEach(workBlockId => {
                            const dayBlockKey = `${dateKey}-${workBlockId}`;
                            delete schedule[dayBlockKey];
                        });
                        saveData();
                        renderCalendar();
                        updateStats();
                    };
                    
                    // Add hover effects for highlighting
                    clearVerticalBtn.addEventListener('mouseenter', () => {
                        highlightVerticalBlocks(dateKey);
                    });
                    clearVerticalBtn.addEventListener('mouseleave', () => {
                        clearHighlights();
                    });
                    
                    clearBtnContainer.appendChild(clearVerticalBtn);
                }
                
                timeBlock.appendChild(clearBtnContainer);

                // Make droppable (only in admin mode)
                timeBlock.addEventListener('dragover', (e) => {
                    if (!isAdminMode) {
                        e.preventDefault();
                        return;
                    }
                    e.preventDefault();
                    timeBlock.classList.add('drag-over');
                });

                timeBlock.addEventListener('dragleave', () => {
                    timeBlock.classList.remove('drag-over');
                });

                timeBlock.addEventListener('drop', (e) => {
                    if (!isAdminMode) {
                        e.preventDefault();
                        return;
                    }
                    e.preventDefault();
                    timeBlock.classList.remove('drag-over');
                    
                    // Check if dropping an assignment (task) or a team member
                    if (window.draggingAssignment) {
                        handleAssignmentDrop(e, blockKey);
                    } else {
                        handleDrop(e, blockKey);
                    }
                });
            }

            dayColumn.appendChild(timeBlock);
        });

        calendarGrid.appendChild(dayColumn);
    });

    // Add duplicate buttons between day columns
    addDuplicateButtons();
}

// Add duplicate buttons between day columns
function addDuplicateButtons() {
    if (!isAdminMode) return; // Don't show duplicate buttons in view mode
    
    const calendarGrid = document.getElementById('calendarGrid');
    const dayColumns = calendarGrid.querySelectorAll('.day-column');
    
    dayColumns.forEach((dayColumn, dayIndex) => {
        if (dayIndex < dayColumns.length - 1) {
            // Add duplicate button to each work block in this day column
            const workBlocks = dayColumn.querySelectorAll('.work-block');
            workBlocks.forEach((workBlock, blockIndex) => {
                const duplicateBtn = document.createElement('button');
                duplicateBtn.className = 'duplicate-btn';
                duplicateBtn.innerHTML = '📋';
                duplicateBtn.title = 'Duplicate this block across the week';
                duplicateBtn.style.position = 'absolute';
                duplicateBtn.style.right = '-16px';
                duplicateBtn.style.top = '50%';
                duplicateBtn.style.transform = 'translateY(-50%)';
                duplicateBtn.style.zIndex = '15';
                
                duplicateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                    const timeBlocks = ['Work1', 'Work2', 'Work3'];
                    const blockId = timeBlocks[blockIndex];
                    
                    const sourceDate = new Date(currentWeekStart);
                    sourceDate.setDate(currentWeekStart.getDate() + dayIndex);
                    const sourceDateKey = formatDateKey(sourceDate, days[dayIndex]);
                    const sourceBlockKey = `${sourceDateKey}-${blockId}`;
                    const sourceAssignments = schedule[sourceBlockKey] || [];
                    
                    if (sourceAssignments.length > 0) {
                        saveStateToHistory();
                        days.forEach((day, targetDayIndex) => {
                            // Only overwrite days AFTER the source day, not before
                            if (targetDayIndex > dayIndex) {
                                const targetDate = new Date(currentWeekStart);
                                targetDate.setDate(currentWeekStart.getDate() + targetDayIndex);
                                const targetDateKey = formatDateKey(targetDate, day);
                                const targetBlockKey = `${targetDateKey}-${blockId}`;
                                
                                // Always overwrite existing assignments
                                schedule[targetBlockKey] = JSON.parse(JSON.stringify(sourceAssignments));
                            }
                        });
                        saveData();
                        renderCalendar();
                        updateStats();
                    } else {
                        alert('No assignments to duplicate in this block.');
                    }
                });
                
                workBlock.style.position = 'relative';
                workBlock.appendChild(duplicateBtn);
            });
        }
    });

    if (isLeadershipMode) renderAllLeadershipTimeEntries();
}


// Format date key for storage
function formatDateKey(date, day) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayNum = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayNum}-${day}`;
}

// Day names for calendar (getDay(): 0=Sun .. 6=Sat)
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayNameFromDate(date) {
    return DAY_NAMES_FULL[date.getDay()];
}

function isSameCalendarDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getProductionWorkBlockIds() {
    return (timeBlocks || [])
        .filter(b => b && typeof b.id === 'string')
        .filter(b => !b.id.startsWith('leadership-'))
        .filter(b => b.id !== 'Lunch')
        .map(b => b.id);
}

// If previous versions stored week dates shifted by UTC (toISOString), the schedule keys for a given week
// can end up off-by-one day. This migrates keys for the *currently viewed week* only.
function migrateScheduleKeysForViewedWeekIfNeeded() {
    try {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const blockIds = getProductionWorkBlockIds();
        if (!blockIds.length) return false;
        if (!schedule || typeof schedule !== 'object') return false;

        const shifts = [-1, 0, 1];
        const scoreForShift = (shiftDays) => {
            let score = 0;
            let candidates = 0;
            days.forEach((dayLabel, dayIndex) => {
                const expectedDate = new Date(currentWeekStart);
                expectedDate.setDate(currentWeekStart.getDate() + dayIndex);
                expectedDate.setHours(0, 0, 0, 0);

                const shiftedDate = new Date(expectedDate);
                shiftedDate.setDate(expectedDate.getDate() + shiftDays);
                shiftedDate.setHours(0, 0, 0, 0);

                const expectedDateKey = formatDateKey(expectedDate, dayLabel);
                const shiftedDateKey = formatDateKey(shiftedDate, dayLabel); // keep UI day label

                blockIds.forEach(blockId => {
                    const expectedKey = `${expectedDateKey}-${blockId}`;
                    const shiftedKey = `${shiftedDateKey}-${blockId}`;
                    const expectedList = schedule[expectedKey];
                    const shiftedList = schedule[shiftedKey];
                    const expectedEmpty = !Array.isArray(expectedList) || expectedList.length === 0;
                    const shiftedHas = Array.isArray(shiftedList) && shiftedList.length > 0;
                    if (expectedEmpty) candidates++;
                    if (expectedEmpty && shiftedHas) score++;
                });
            });
            return { score, candidates };
        };

        const scored = shifts.map(s => ({ shift: s, ...scoreForShift(s) }));
        const best = scored.reduce((a, b) => (b.score > a.score ? b : a), scored[0]);

        // If the "no shift" already matches best, or we have nothing to migrate, do nothing.
        if (!best || best.shift === 0 || best.score === 0) return false;

        console.warn(`[WeekSchedule] Detected shifted schedule keys. Migrating week by ${best.shift} day(s) for viewed week.`);

        let moved = 0;
        days.forEach((dayLabel, dayIndex) => {
            const expectedDate = new Date(currentWeekStart);
            expectedDate.setDate(currentWeekStart.getDate() + dayIndex);
            expectedDate.setHours(0, 0, 0, 0);

            const shiftedDate = new Date(expectedDate);
            shiftedDate.setDate(expectedDate.getDate() + best.shift);
            shiftedDate.setHours(0, 0, 0, 0);

            const expectedDateKey = formatDateKey(expectedDate, dayLabel);
            const shiftedDateKey = formatDateKey(shiftedDate, dayLabel);

            blockIds.forEach(blockId => {
                const expectedKey = `${expectedDateKey}-${blockId}`;
                const shiftedKey = `${shiftedDateKey}-${blockId}`;
                const expectedList = schedule[expectedKey];
                const shiftedList = schedule[shiftedKey];
                const expectedEmpty = !Array.isArray(expectedList) || expectedList.length === 0;
                const shiftedHas = Array.isArray(shiftedList) && shiftedList.length > 0;
                if (expectedEmpty && shiftedHas) {
                    schedule[expectedKey] = shiftedList;
                    delete schedule[shiftedKey];
                    moved++;
                }
            });
        });

        if (moved > 0) {
            try {
                // Persist the corrected keys so the fix is permanent.
                saveSchedule().catch(() => {});
                localStorage.setItem('schedule', JSON.stringify(schedule));
            } catch (_) {}
            console.log(`[WeekSchedule] Migrated ${moved} block(s) for viewed week.`);
            return true;
        }

        return false;
    } catch (e) {
        console.warn('[WeekSchedule] Migration failed:', e);
        return false;
    }
}

// Resolve current leadership date (from storage or today), optionally persist
function getCurrentLeadershipDate() {
    if (currentLeadershipDate) return currentLeadershipDate;
    const saved = localStorage.getItem('leadershipSelectedDate');
    if (saved) {
        const [y, m, d] = saved.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            currentLeadershipDate = new Date(y, m - 1, d);
            return currentLeadershipDate;
        }
    }
    currentLeadershipDate = new Date();
    currentLeadershipDate.setHours(0, 0, 0, 0);
    return currentLeadershipDate;
}

function setCurrentLeadershipDate(date) {
    currentLeadershipDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    localStorage.setItem('leadershipSelectedDate',
        `${currentLeadershipDate.getFullYear()}-${String(currentLeadershipDate.getMonth() + 1).padStart(2, '0')}-${String(currentLeadershipDate.getDate()).padStart(2, '0')}`);
}

// Handle drop event for team members
function handleDrop(e, blockKey) {
    const data = e.dataTransfer.getData('text/plain');
    const [type, value] = data.split(':');

    if (type === 'member') {
        // Show client selection modal
        showClientModal(value, blockKey);
    }
}

// Handle drop event for assignments (tasks)
function handleAssignmentDrop(e, blockKey) {
    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const sourceBlock = data.sourceBlock;
        const assignmentIndex = data.assignmentIndex;
        const assignment = data.assignment;
        const isDuplicating = e.shiftKey;
        
        // Don't allow dropping on the same block
        if (sourceBlock === blockKey) {
            return;
        }
        
        saveStateToHistory();
        
        // Initialize target block if needed
        if (!schedule[blockKey]) {
            schedule[blockKey] = [];
        }
        
        // Check if member is already in target block and remove existing assignment
        const targetAssignments = schedule[blockKey];
        const existingIndex = targetAssignments.findIndex(
            a => a.member === assignment.member
        );
        
        // If member already exists, remove the old assignment
        if (existingIndex !== -1) {
            targetAssignments.splice(existingIndex, 1);
        }
        
        // Add the new assignment
        schedule[blockKey].push({
            member: assignment.member,
            client: assignment.client
        });
        
        // Remove from source block if not duplicating
        if (!isDuplicating) {
            if (schedule[sourceBlock] && Array.isArray(schedule[sourceBlock])) {
                schedule[sourceBlock].splice(assignmentIndex, 1);
                if (schedule[sourceBlock].length === 0) {
                    delete schedule[sourceBlock];
                }
            }
        }
        
        saveData();
        renderCalendar();
        updateStats();
    } catch (err) {
        console.error('Error handling assignment drop:', err);
    }
}

// Show client selection modal
// Show member selection modal
function showMemberModal(blockKey) {
    if (!isAdminMode) return;
    
    const modal = document.getElementById('memberModal');
    const memberList = document.getElementById('memberSelectionList');
    
    memberList.innerHTML = '';
    
    // Get already assigned members for this block
    const existingAssignments = schedule[blockKey] || [];
    const assignedMemberNames = new Set(existingAssignments.map(a => a.member));
    
    // Filter out members who are already assigned to this block
    const availableMembers = teamMembers.filter(member => !assignedMemberNames.has(member.name));
    
    if (availableMembers.length === 0) {
        memberList.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">All members are already assigned to this block.</p>';
    } else {
        availableMembers.forEach(member => {
            const option = document.createElement('div');
            option.className = 'client-option';
            option.style.borderColor = member.color;
            const profileDisplay = member.profilePicture ? 
                `<img src="${member.profilePicture}" alt="${member.name}" class="draggable-item-profile circular" style="background-color: ${member.color}; width: 40px; height: 40px; object-fit: cover; border-radius: 50%;">` :
                `<div class="draggable-item-profile circular" style="background-color: ${member.color}; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: ${getContrastTextColor(member.color)}; font-weight: bold;">${member.name.charAt(0).toUpperCase()}</div>`;
            option.innerHTML = `
                ${profileDisplay}
                <span>${member.name}</span>
            `;
            option.onclick = () => {
                closeMemberModal();
                showClientModal(member.name, blockKey);
            };
            memberList.appendChild(option);
        });
    }
    
    modal.classList.add('show');
    window.currentBlockKey = blockKey;
}

// Close member modal
function closeMemberModal() {
    const modal = document.getElementById('memberModal');
    modal.classList.remove('show');
}

function showClientModal(memberName, blockKey, assignmentIndex = null) {
    const modal = document.getElementById('clientModal');
    const clientList = document.getElementById('clientSelectionList');
    
    clientList.innerHTML = '';
    
    let currentClient = '';
    let currentProject = '';
    if (assignmentIndex !== null && schedule[blockKey] && schedule[blockKey][assignmentIndex]) {
        const a = schedule[blockKey][assignmentIndex];
        currentClient = a.client || '';
        currentProject = a.project || '';
    }
    if (clients.length === 0) {
        clientList.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No clients available. Add clients in Settings.</p>';
    } else {
        clients.forEach(client => {
            const option = document.createElement('div');
            option.className = 'client-option client-option-with-project';
            option.style.borderColor = client.color;
            const clientProjects = projects.filter(p => p.clientName === client.name);
            const projectOptions = '<option value="">— No project —</option>' +
                clientProjects.map(p => `<option value="${(p.name || '').replace(/"/g, '&quot;')}" ${(currentClient === client.name && currentProject === (p.name || '')) ? 'selected' : ''}>${(p.name || '').replace(/</g, '&lt;')}${p.budget != null ? ' ($' + p.budget + ')' : ''}</option>`).join('');
            option.innerHTML = `
                <div class="client-option-color" style="background-color: ${client.color}"></div>
                <span class="client-option-name">${client.name}</span>
                <select class="client-project-select" onclick="event.stopPropagation()">
                    ${projectOptions}
                </select>
            `;
            option.onclick = (e) => {
                if (e.target.classList.contains('client-project-select')) return;
                const select = option.querySelector('.client-project-select');
                const projectName = (select && select.value) ? select.value : null;
                if (assignmentIndex !== null && window.editingAssignment) {
                    updateAssignmentClient(blockKey, assignmentIndex, client.name, projectName);
                } else {
                    assignMemberToBlock(memberName, client.name, blockKey, projectName);
                }
                closeClientModal();
            };
            clientList.appendChild(option);
        });
    }
    
    modal.classList.add('show');
    window.currentBlockKey = blockKey;
    window.currentMemberName = memberName;
}

// Update assignment client (and optional project)
function updateAssignmentClient(blockKey, assignmentIndex, newClientName, newProjectName = null) {
    if (!isAdminMode) return;
    
    saveStateToHistory();
    if (schedule[blockKey] && Array.isArray(schedule[blockKey]) && schedule[blockKey][assignmentIndex]) {
        schedule[blockKey][assignmentIndex].client = newClientName;
        if (newProjectName) {
            schedule[blockKey][assignmentIndex].project = newProjectName;
        } else {
            delete schedule[blockKey][assignmentIndex].project;
        }
        saveData();
        renderCalendar();
        updateStats();
    }
    window.editingAssignment = null;
}

// Close client modal
function closeClientModal() {
    const modal = document.getElementById('clientModal');
    modal.classList.remove('show');
}

// Assign member to block (optional project for budget tracking)
function assignMemberToBlock(memberName, clientName, blockKey, projectName = null) {
    if (!isAdminMode) return;
    
    if (!schedule[blockKey]) {
        schedule[blockKey] = [];
    }
    
    const existingIndex = schedule[blockKey].findIndex(
        assignment => assignment.member === memberName
    );
    if (existingIndex !== -1) {
        schedule[blockKey].splice(existingIndex, 1);
    }
    
    saveStateToHistory();
    const assignment = { member: memberName, client: clientName };
    if (projectName) assignment.project = projectName;
    schedule[blockKey].push(assignment);
    saveData();
    renderCalendar();
    updateStats();
}

// Edit assignment client
function editAssignmentClient(blockKey, assignmentIndex, assignment) {
    if (!isAdminMode) return;
    
    // Store the assignment info for editing
    window.editingAssignment = {
        blockKey: blockKey,
        assignmentIndex: assignmentIndex,
        member: assignment.member
    };
    
    // Show client selection modal
    showClientModal(assignment.member, blockKey, assignmentIndex);
}

// Remove assignment
function removeAssignment(blockKey, assignmentIndex) {
    if (!isAdminMode) return;
    
    saveStateToHistory();
    if (schedule[blockKey] && Array.isArray(schedule[blockKey])) {
        schedule[blockKey].splice(assignmentIndex, 1);
        if (schedule[blockKey].length === 0) {
            delete schedule[blockKey];
        }
    } else {
        delete schedule[blockKey];
    }
    saveData();
    renderCalendar();
    updateStats();
}

// Render sidebar (in leadership mode shows leadership members, same drag-to-block behaviour)
function renderSidebar() {
    const membersList = document.getElementById('teamMembersList');
    const clientsList = document.getElementById('clientsList');
    const membersSectionTitle = document.getElementById('membersSectionTitle');
    const membersToShow = isLeadershipMode ? leadershipMembers : teamMembers;

    if (membersSectionTitle) {
        membersSectionTitle.textContent = isLeadershipMode ? 'Leadership Members' : 'Production Members';
    }
    membersList.innerHTML = '';
    membersToShow.forEach(member => {
        const item = document.createElement('div');
        item.className = 'draggable-item';
        const profileDisplay = member.profilePicture ? 
            `<img src="${member.profilePicture}" alt="${member.name}" class="sidebar-profile-picture">` : 
            `<div class="sidebar-profile-initial">${member.name.charAt(0).toUpperCase()}</div>`;
        item.innerHTML = `
            <div class="draggable-item-profile circular" style="background-color: ${member.color}">
                ${profileDisplay}
            </div>
            <span>${member.name}</span>
        `;
        item.dataset.type = 'member';
        item.dataset.value = member.name;
        item.draggable = isAdminMode || isLeadershipMode;
        
        if (isAdminMode || isLeadershipMode) {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', `member:${member.name}`);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
        }

        membersList.appendChild(item);
    });

    clientsList.innerHTML = '';
    clients.forEach(client => {
        const item = document.createElement('div');
        item.className = 'draggable-item';
        item.innerHTML = `
            <div class="draggable-item-color circular" style="background-color: ${client.color}"></div>
            <span>${client.name}</span>
        `;
        clientsList.appendChild(item);
    });
}

// Render settings
function renderSettings() {
    const membersList = document.getElementById('membersSettingsList');
    const leadershipMembersList = document.getElementById('leadershipMembersSettingsList');
    const clientsList = document.getElementById('clientsSettingsList');

    if (!membersList) return;

    membersList.innerHTML = '';
    teamMembers.forEach((member, index) => {
        const item = document.createElement('div');
        item.className = 'settings-item';
        const disabledAttr = isAdminMode ? '' : 'disabled';
        const disabledStyle = isAdminMode ? '' : 'opacity: 0.5; pointer-events: none;';
        item.innerHTML = `
            <div class="settings-item-profile-section" style="${disabledStyle}">
                <div class="profile-picture-container">
                    <label for="memberProfile${index}" class="profile-picture-label">
                        ${member.profilePicture ? 
                            `<img src="${member.profilePicture}" alt="${member.name}" class="profile-picture-preview">` : 
                            `<div class="profile-picture-placeholder">+</div>`
                        }
                    </label>
                    <input type="file" id="memberProfile${index}" accept="image/*" 
                           onchange="updateMemberProfile(${index}, this)" class="profile-picture-input" style="display: none;" ${disabledAttr}>
                </div>
                <div class="settings-item-color-picker">
                    <input type="color" id="memberColor${index}" value="${member.color}" 
                           onchange="updateMemberColor(${index}, this.value)" class="color-picker" ${disabledAttr}>
                    <label for="memberColor${index}" class="color-picker-label"></label>
                </div>
            </div>
            <span class="settings-item-name">${member.name}</span>
            <span class="settings-item-rate-display">${member.hourlyRate != null && member.hourlyRate !== '' ? '$' + member.hourlyRate : '—'}</span>
            <div class="settings-item-actions" style="${disabledStyle}">
                <button class="btn-edit" onclick="editMember(${index})" ${disabledAttr}>Edit</button>
                <button class="btn-delete" onclick="deleteMember(${index})" ${disabledAttr}>Delete</button>
            </div>
        `;
        membersList.appendChild(item);
    });

    if (leadershipMembersList) {
    leadershipMembersList.innerHTML = '';
    leadershipMembers.forEach((member, index) => {
        const item = document.createElement('div');
        item.className = 'settings-item';
        const disabledAttr = isAdminMode ? '' : 'disabled';
        const disabledStyle = isAdminMode ? '' : 'opacity: 0.5; pointer-events: none;';
        item.innerHTML = `
            <div class="settings-item-profile-section" style="${disabledStyle}">
                <div class="profile-picture-container">
                    <label for="leadershipProfile${index}" class="profile-picture-label">
                        ${member.profilePicture ?
                            `<img src="${member.profilePicture}" alt="${member.name}" class="profile-picture-preview">` :
                            `<div class="profile-picture-placeholder">+</div>`
                        }
                    </label>
                    <input type="file" id="leadershipProfile${index}" accept="image/*"
                           onchange="updateLeadershipMemberProfile(${index}, this)" class="profile-picture-input" style="display: none;" ${disabledAttr}>
                </div>
                <div class="settings-item-color-picker">
                    <input type="color" id="leadershipColor${index}" value="${member.color}"
                           onchange="updateLeadershipMemberColor(${index}, this.value)" class="color-picker" ${disabledAttr}>
                    <label for="leadershipColor${index}" class="color-picker-label"></label>
                </div>
            </div>
            <span class="settings-item-name">${member.name}</span>
            <span class="settings-item-rate-display">${member.hourlyRate != null && member.hourlyRate !== '' ? '$' + member.hourlyRate : '—'}</span>
            <div class="settings-item-actions" style="${disabledStyle}">
                <button class="btn-edit" onclick="editLeadershipMember(${index})" ${disabledAttr}>Edit</button>
                <button class="btn-delete" onclick="deleteLeadershipMember(${index})" ${disabledAttr}>Delete</button>
            </div>
        `;
        leadershipMembersList.appendChild(item);
    });
    }

    const projectsList = document.getElementById('projectsSettingsList');
    if (projectsList) {
        projectsList.innerHTML = '';
        projects.forEach((project, index) => {
            const item = document.createElement('div');
            item.className = 'settings-item';
            const disabledAttr = isAdminMode ? '' : 'disabled';
            const disabledStyle = isAdminMode ? '' : 'opacity: 0.5; pointer-events: none;';
            item.innerHTML = `
                <div class="settings-item-color-picker" style="${disabledStyle}">
                    <input type="color" id="projectColor${index}" value="${project.color || '#667eea'}" 
                           onchange="updateProjectColor(${index}, this.value)" class="color-picker" ${disabledAttr}>
                    <label for="projectColor${index}" class="color-picker-label"></label>
                </div>
                <span class="settings-item-name">${(project.name || '').replace(/</g, '&lt;')}</span>
                <div class="settings-item-actions" style="${disabledStyle}">
                    <button class="btn-edit btn-edit-icon" onclick="openProjectDetail(${index})" ${disabledAttr} title="Edit project (name, client, budget)">&#9998;</button>
                    <button class="btn-delete" onclick="deleteProject(${index})" ${disabledAttr}>Delete</button>
                </div>
            `;
            projectsList.appendChild(item);
        });
    }

    if (isAdminMode) {
        const reportSection = document.getElementById('leadershipReportsSection');
        if (reportSection) {
            reportSection.style.display = 'block';
            renderLeadershipReports();
        }
    } else {
        const reportSection = document.getElementById('leadershipReportsSection');
        if (reportSection) reportSection.style.display = 'none';
    }
}

function renderLeadershipReports() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:renderLeadershipReports',message:'entry',data:{reportPeriodWeekStart:typeof window.reportPeriodWeekStart!=='undefined'?String(window.reportPeriodWeekStart):'undef',currentWeekStart:currentWeekStart?currentWeekStart.toISOString():null,scheduleKeys:Object.keys(schedule).length,leadershipScheduleKeys:Object.keys(leadershipSchedule).length},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    if (typeof window.reportPeriodWeekStart === 'undefined') {
        window.reportPeriodWeekStart = new Date(currentWeekStart);
    }
    const weekStart = window.reportPeriodWeekStart;
    const periodLabel = document.getElementById('reportPeriodLabel');
    const tbody = document.getElementById('projectsDataTableBody');
    if (!periodLabel || !tbody) return;

    if (weekStart === null) {
        periodLabel.textContent = 'All time';
    } else {
        const we = new Date(weekStart);
        we.setDate(we.getDate() + 4);
        const opts = { month: 'short', day: 'numeric', year: 'numeric' };
        periodLabel.textContent = weekStart.toLocaleDateString('en-US', opts) + ' – ' + we.toLocaleDateString('en-US', opts);
    }

    const { byProject } = aggregateHoursAndCostByClientAndProject(weekStart);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:renderLeadershipReports',message:'after aggregate',data:{byProjectKeys:Object.keys(byProject).length,byProjectSample:Object.keys(byProject).slice(0,3)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const projectEntries = Object.entries(byProject)
        .filter(([, v]) => v.hours > 0)
        .sort((a, b) => b[1].cost - a[1].cost);

    tbody.innerHTML = '';
    if (projectEntries.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" class="report-empty">No project data for this period.</td>';
        tbody.appendChild(tr);
    } else {
        projectEntries.forEach(([, v]) => {
            const projectLabel = (v.clientName || '').replace(/</g, '&lt;') + (v.projectName && v.projectName !== v.clientName ? ' → ' + (v.projectName || '').replace(/</g, '&lt;') : '');
            const budgetStr = v.budget != null ? `$${Math.round(v.budget)}` : '—';
            const pctUsed = v.budget != null && v.budget > 0
                ? ((v.cost / v.budget) * 100).toFixed(1) + '%'
                : '—';
            const spentStr = `$${Math.round(v.cost)}`;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="report-name">${projectLabel || '—'}</td><td>${v.hours.toFixed(1)}</td><td>${spentStr}</td><td>${budgetStr}</td><td>${pctUsed}</td><td>${spentStr}</td>`;
            tbody.appendChild(tr);
        });
    }
}

function initLeadershipReportButtons() {
    const prevBtn = document.getElementById('reportWeekPrev');
    const nextBtn = document.getElementById('reportWeekNext');
    const allTimeBtn = document.getElementById('reportShowAllTime');
    if (prevBtn) prevBtn.addEventListener('click', () => {
        if (window.reportPeriodWeekStart === null) window.reportPeriodWeekStart = new Date(currentWeekStart);
        const w = window.reportPeriodWeekStart ? new Date(window.reportPeriodWeekStart) : new Date(currentWeekStart);
        w.setDate(w.getDate() - 7);
        window.reportPeriodWeekStart = w;
        renderLeadershipReports();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        if (window.reportPeriodWeekStart === null) window.reportPeriodWeekStart = new Date(currentWeekStart);
        const w = window.reportPeriodWeekStart ? new Date(window.reportPeriodWeekStart) : new Date(currentWeekStart);
        w.setDate(w.getDate() + 7);
        window.reportPeriodWeekStart = w;
        renderLeadershipReports();
    });
    if (allTimeBtn) allTimeBtn.addEventListener('click', () => {
        window.reportPeriodWeekStart = null;
        renderLeadershipReports();
    });
}

// Online users strip: Google Docs style — 1 = single circle, 2–3 = overlapping, 4+ = stacked with +N
function renderOnlineUsersStrip() {
    const strip = document.getElementById('onlineUsersStrip');
    if (!strip) return;
    strip.innerHTML = '';
    const list = onlineUsersFromServer.length > 0 ? onlineUsersFromServer : (currentUser ? [currentUser] : []);
    const count = list.length;
    const overlap = count >= 2;
    const showOverlapClass = overlap ? ' online-avatar-wrap-overlap' : '';
    const maxVisible = 3;
    const visible = count <= maxVisible ? list : list.slice(0, maxVisible);
    const extraCount = count > maxVisible ? count - maxVisible : 0;

    visible.forEach((user, index) => {
        const wrap = document.createElement('span');
        wrap.className = 'online-avatar-wrap' + showOverlapClass;
        wrap.title = (currentUser && user.email === currentUser.email) ? 'You' : (user.firstName || user.lastName || user.email || '?');
        const borderColor = user.avatarBorderColor || '#318cc3';
        const displayName = user.firstName || user.lastName || user.email || '?';
        if (user.profilePictureUrl) {
            const img = document.createElement('img');
            img.src = user.profilePictureUrl;
            img.alt = displayName;
            img.className = 'online-avatar';
            img.style.borderColor = borderColor;
            wrap.appendChild(img);
        } else {
            const circle = document.createElement('div');
            circle.className = 'online-avatar';
            circle.style.display = 'flex';
            circle.style.alignItems = 'center';
            circle.style.justifyContent = 'center';
            circle.style.fontSize = '0.9rem';
            circle.style.fontWeight = '600';
            circle.style.color = 'var(--dark-text)';
            circle.style.borderColor = borderColor;
            circle.textContent = (displayName).charAt(0).toUpperCase();
            wrap.appendChild(circle);
        }
        strip.appendChild(wrap);
    });

    if (extraCount > 0) {
        const wrap = document.createElement('span');
        wrap.className = 'online-avatar-wrap' + showOverlapClass;
        wrap.title = extraCount + ' more viewing';
        const more = document.createElement('div');
        more.className = 'online-avatar online-avatar-more';
        more.textContent = '+' + extraCount;
        wrap.appendChild(more);
        strip.appendChild(wrap);
    }
}

// Count workblocks per client (for Dashboard)
function renderWorkblocksPerClient() {
    const workblocksList = document.getElementById('workblocksPerClientList');
    if (!workblocksList) return;
    const counts = {};
    Object.keys(schedule).forEach(blockKey => {
        const assignments = schedule[blockKey] || [];
        assignments.forEach(a => {
            if (a && a.client) {
                counts[a.client] = (counts[a.client] || 0) + 1;
            }
        });
    });
    workblocksList.innerHTML = '';
    if (Object.keys(counts).length === 0) {
        workblocksList.innerHTML = '<p class="muted">No workblocks assigned yet.</p>';
    } else {
        const entries = clients.map(client => ({ name: client.name, count: counts[client.name] || 0 }));
        entries.sort((a, b) => b.count - a.count);
        entries.forEach(({ name, count }) => {
            const row = document.createElement('div');
            row.className = 'workblocks-row';
            row.innerHTML = `<span>${name}</span><strong>${count}</strong>`;
            workblocksList.appendChild(row);
        });
    }
}

// Calculate assigned hours for a week
function calculateAssignedHours(weekStart) {
    const assignedHours = {}; // { memberName: { clientName: hours } }
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Ensure weekStart is a proper Date object and set to start of day
    const weekStartDate = new Date(weekStart);
    weekStartDate.setHours(0, 0, 0, 0);
    
    days.forEach((day, dayIndex) => {
        const dayDate = new Date(weekStartDate);
        dayDate.setDate(weekStartDate.getDate() + dayIndex);
        const dateKey = formatDateKey(dayDate, day);
        
        timeBlocks.forEach(block => {
            if (block.isLunch) return;
            
            const blockKey = `${dateKey}-${block.id}`;
            const assignments = schedule[blockKey] || [];
            
            // Calculate hours for this block
            const startHour = parseInt(block.startTime.split(':')[0]);
            const endHour = parseInt(block.endTime.split(':')[0]);
            const blockHours = endHour - startHour;
            
            // Process each assignment in this block
            assignments.forEach(assignment => {
                if (!assignment || !assignment.member || !assignment.client) return;
                
                if (!assignedHours[assignment.member]) {
                    assignedHours[assignment.member] = {};
                }
                if (!assignedHours[assignment.member][assignment.client]) {
                    assignedHours[assignment.member][assignment.client] = 0;
                }
                assignedHours[assignment.member][assignment.client] += blockHours;
            });
        });
    });
    
    return assignedHours;
}

// Get week key from date
function getWeekKey(date) {
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

// Get week number from date
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Render time tracking section
function renderTimeTracking() {
    const timeTrackingContent = document.getElementById('timeTrackingContent');
    if (!timeTrackingContent) return;
    
    // Use timeTrackingWeekStart (separate from calendar week, but syncs when settings opens)
    // If timeTrackingWeekStart is not set, use currentWeekStart
    if (typeof window.timeTrackingWeekStart === 'undefined') {
        window.timeTrackingWeekStart = new Date(currentWeekStart);
    }
    const weekStart = new Date(window.timeTrackingWeekStart);
    weekStart.setHours(0, 0, 0, 0);
    
    // Update the week display
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4); // Monday to Friday
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const startStr = weekStart.toLocaleDateString('en-US', options);
    const endStr = weekEnd.toLocaleDateString('en-US', options);
    
    // Update week display in time tracking
    const weekDisplay = document.getElementById('timeTrackingWeekDisplay');
    if (weekDisplay) {
        weekDisplay.textContent = `${startStr} - ${endStr}`;
    }
    
    // Calculate assigned hours from schedule
    const assignedHours = calculateAssignedHours(weekStart);
    const weekKey = getWeekKey(weekStart);
    const actualHours = weeklyTimeTracking[weekKey] || {};
    
    // Debug: log what we found
    console.log('Time tracking for week:', weekKey, 'Week start:', weekStart, 'Assigned hours:', assignedHours);
    
    // Build member panels - show ALL members who have assignments
    let html = '<div class="time-tracking-members">';
    
    // Get all members who have assignments this week
    const membersWithAssignments = new Set();
    Object.keys(assignedHours).forEach(memberName => {
        if (Object.keys(assignedHours[memberName]).length > 0) {
            membersWithAssignments.add(memberName);
        }
    });
    
    // Also include members who have actual hours entered
    Object.keys(actualHours).forEach(memberName => {
        membersWithAssignments.add(memberName);
    });
    
    // Show panels for all members (even if no assignments, so they can enter data)
    teamMembers.forEach(member => {
        const memberAssigned = assignedHours[member.name] || {};
        const memberActual = actualHours[member.name] || {};
        const memberColor = member.color || '#ce2828';
        
        // Calculate total assigned and actual for this member
        let totalAssigned = 0;
        let totalActual = 0;
        Object.keys(memberAssigned).forEach(clientName => {
            totalAssigned += memberAssigned[clientName];
            totalActual += memberActual[clientName] || 0;
        });
        
        // Also count actual hours for clients not in assigned
        Object.keys(memberActual).forEach(clientName => {
            if (!memberAssigned[clientName]) {
                totalActual += memberActual[clientName] || 0;
            }
        });
        
        // Only show members who have assignments or actual hours
        if (Object.keys(memberAssigned).length === 0 && totalActual === 0) {
            return;
        }
        
        const memberHeaderTextColor = getContrastTextColor(memberColor);
        html += `<div class="time-tracking-member-panel">
            <div class="member-panel-header" style="background-color: ${memberColor}; color: ${memberHeaderTextColor};">
                <h4 style="color: ${memberHeaderTextColor};">${member.name}</h4>
                <div class="member-totals">
                    <span style="color: ${memberHeaderTextColor};">Total Assigned: ${totalAssigned.toFixed(1)}h</span>
                    <span style="color: ${memberHeaderTextColor};">Total Toggl: ${totalActual.toFixed(1)}h</span>
                </div>
            </div>
            <div class="member-clients-list">`;
        
        // Show each client this member worked on (from schedule)
        Object.keys(memberAssigned).forEach(clientName => {
            const assigned = memberAssigned[clientName];
            const actual = memberActual[clientName] || 0;
            const diff = actual - assigned;
            const statusClass = diff > 0 ? 'over' : diff < 0 ? 'under' : 'ontarget';
            const client = clients.find(c => c.name === clientName);
            const clientColor = client ? client.color : '#667eea';
            
            html += `<div class="member-client-item">
                <div class="client-info">
                    <div class="client-color-indicator" style="background-color: ${clientColor}"></div>
                    <span class="client-name">${clientName}</span>
                    <span class="assigned-hours">${assigned.toFixed(1)}h assigned</span>
                </div>
                <div class="client-input-section">
                    <label>Toggl:</label>
                    <input type="number" step="0.1" min="0" value="${actual}" 
                        onchange="updateTimeTracking('${weekKey}', '${member.name}', '${clientName}', this.value)" 
                        class="time-input" ${isAdminMode ? '' : 'disabled'}>
                    <span class="hours-label">h</span>
                    ${diff !== 0 ? `<span class="diff-badge ${statusClass}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}h</span>` : ''}
                </div>
            </div>`;
        });
        
        // Also show clients with actual hours but no assignments (manually added)
        Object.keys(memberActual).forEach(clientName => {
            if (!memberAssigned[clientName] && memberActual[clientName] > 0) {
                const actual = memberActual[clientName];
                const client = clients.find(c => c.name === clientName);
                const clientColor = client ? client.color : '#667eea';
                
                html += `<div class="member-client-item">
                    <div class="client-info">
                        <div class="client-color-indicator" style="background-color: ${clientColor}"></div>
                        <span class="client-name">${clientName}</span>
                        <span class="assigned-hours">0h assigned</span>
                    </div>
                    <div class="client-input-section">
                        <label>Toggl:</label>
                        <input type="number" step="0.1" min="0" value="${actual}" 
                            onchange="updateTimeTracking('${weekKey}', '${member.name}', '${clientName}', this.value)" 
                            class="time-input" ${isAdminMode ? '' : 'disabled'}>
                        <span class="hours-label">h</span>
                    </div>
                </div>`;
            }
        });
        
        html += `</div></div>`;
    });
    
    if (html === '<div class="time-tracking-members">') {
        html += '<p style="padding: 1rem; color: var(--dark-text);">No assignments found for this week. Assign tasks in the calendar first.</p>';
    }
    
    html += '</div>';
    timeTrackingContent.innerHTML = html;
    // Constrain right column height to match left column after rendering
    setTimeout(() => {
        const leftCol = document.querySelector('.settings-left-column');
        const rightCol = document.querySelector('.settings-right-column');
        if (leftCol && rightCol) {
            const leftHeight = leftCol.offsetHeight;
            rightCol.style.maxHeight = leftHeight + 'px';
        }
    }, 50);
}

// Update time tracking
function updateTimeTracking(weekKey, memberName, clientName, hours) {
    if (!isAdminMode) return;
    
    if (!weeklyTimeTracking[weekKey]) {
        weeklyTimeTracking[weekKey] = {};
    }
    if (!weeklyTimeTracking[weekKey][memberName]) {
        weeklyTimeTracking[weekKey][memberName] = {};
    }
    
    const hoursNum = parseFloat(hours) || 0;
    if (hoursNum > 0) {
        weeklyTimeTracking[weekKey][memberName][clientName] = hoursNum;
    } else {
        delete weeklyTimeTracking[weekKey][memberName][clientName];
    }
    
    saveData();
    renderTimeTracking();
}

// Setup event listeners
function setupEventListeners() {
    // Dashboard (own page) - only on tool page
    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            if (!isAdminMode) {
                document.getElementById('adminModal').classList.add('show');
            } else {
                const dp = document.getElementById('dashboardPage');
                const scheduleView = document.getElementById('scheduleView');
                if (dp && dp.style.display === 'flex') {
                    if (scheduleView) scheduleView.style.display = 'flex';
                    dp.style.display = 'none';
                    showScheduleBoardView();
                    return;
                }
                if (scheduleView) scheduleView.style.display = 'none';
                if (dp) dp.style.display = 'flex';
                renderSettings();
                renderWorkblocksPerClient();
                renderTimeTracking();
            }
        });
    }
    const backToScheduleBtn = document.getElementById('backToScheduleBtn');
    if (backToScheduleBtn) {
        backToScheduleBtn.addEventListener('click', () => {
            syncLeadershipRatesFromSettingsForm();
            const sp = document.getElementById('settingsPage');
            const dp = document.getElementById('dashboardPage');
            const scheduleView = document.getElementById('scheduleView');
            if (sp) sp.style.display = 'none';
            if (dp) dp.style.display = 'none';
            if (scheduleView) scheduleView.style.display = 'flex';
            showScheduleBoardView();
        });
    }

    async function openProfileModal() {
        if (currentUser) {
            const profileFromSupabase = await loadProfileFromSupabase(currentUser.email);
            if (profileFromSupabase) {
                currentUser.firstName = profileFromSupabase.first_name ?? currentUser.firstName;
                currentUser.lastName = profileFromSupabase.last_name ?? currentUser.lastName;
                currentUser.profilePictureUrl = profileFromSupabase.profile_picture_url ?? currentUser.profilePictureUrl;
                currentUser.avatarBorderColor = profileFromSupabase.avatar_border_color ?? currentUser.avatarBorderColor;
            }
            document.getElementById('profileFirstName').value = currentUser.firstName || '';
            document.getElementById('profileLastName').value = currentUser.lastName || '';
            document.getElementById('profileNewPassword').value = '';
            const borderColorEl = document.getElementById('profileAvatarBorderColor');
            if (borderColorEl) borderColorEl.value = currentUser.avatarBorderColor || '#318cc3';
            const preview = document.getElementById('profilePicturePreview');
            if (preview) {
                preview.innerHTML = '';
                if (currentUser.profilePictureUrl) {
                    const img = document.createElement('img');
                    img.src = currentUser.profilePictureUrl;
                    img.alt = 'Profile';
                    img.style.cssText = 'width:80px;height:80px;border-radius:50%;object-fit:cover;';
                    preview.appendChild(img);
                }
            }
        }
        document.getElementById('profileModal').classList.add('show');
    }
    async function saveProfileAndClose() {
        if (!currentUser) return;
        const firstName = (document.getElementById('profileFirstName') || {}).value.trim();
        const lastName = (document.getElementById('profileLastName') || {}).value.trim();
        const borderColorEl = document.getElementById('profileAvatarBorderColor');
        const previewImg = document.querySelector('#profilePicturePreview img');
        if (previewImg && previewImg.src) currentUser.profilePictureUrl = previewImg.src;
        currentUser.firstName = firstName;
        currentUser.lastName = lastName;
        if (borderColorEl) currentUser.avatarBorderColor = borderColorEl.value || '#318cc3';
        var picToSave = currentUser.profilePictureUrl;
        if (picToSave && picToSave.startsWith('data:') && picToSave.length > 150000) {
            picToSave = await resizeProfilePictureDataUrl(picToSave, 200, 0.8);
            currentUser.profilePictureUrl = picToSave;
        }
        const result = await saveProfileToSupabase({
            email: currentUser.email,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            profilePictureUrl: picToSave,
            avatarBorderColor: currentUser.avatarBorderColor
        });
        if (!result.ok) {
            if (typeof alert !== 'undefined') alert('Could not save to server.\n\n' + (result.message || 'Check SUPABASE_SETUP.md and run ADD_USER_PROFILES.sql in Supabase SQL Editor.'));
            return;
        }
        localStorage.setItem('teamScheduleUser', JSON.stringify(currentUser));
        const users = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
        if (users[currentUser.email]) {
            users[currentUser.email].firstName = currentUser.firstName;
            users[currentUser.email].lastName = currentUser.lastName;
            users[currentUser.email].avatarBorderColor = currentUser.avatarBorderColor;
            users[currentUser.email].profilePictureUrl = currentUser.profilePictureUrl;
        }
        localStorage.setItem('teamScheduleUsers', JSON.stringify(users));
        renderOnlineUsersStrip();
        document.getElementById('profileModal').classList.remove('show');
        if (typeof alert !== 'undefined') alert('Profile saved successfully. Your changes are stored online and your avatar is updated.');
    }
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', openProfileModal);
    }
    const closeProfileModal = document.getElementById('closeProfileModal');
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', () => {
            document.getElementById('profileModal').classList.remove('show');
        });
    }
    const profilePictureInput = document.getElementById('profilePictureInput');
    if (profilePictureInput) {
        profilePictureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                currentUser.profilePictureUrl = ev.target.result;
                const users = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
                if (users[currentUser.email]) users[currentUser.email].profilePictureUrl = ev.target.result;
                localStorage.setItem('teamScheduleUser', JSON.stringify(currentUser));
                localStorage.setItem('teamScheduleUsers', JSON.stringify(users));
                renderOnlineUsersStrip();
                const preview = document.getElementById('profilePicturePreview');
                preview.innerHTML = '';
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.style.cssText = 'width:80px;height:80px;border-radius:50%;object-fit:cover;';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
            }
        });
    }
    const profileChangePasswordBtn = document.getElementById('profileChangePasswordBtn');
    if (profileChangePasswordBtn) {
        profileChangePasswordBtn.addEventListener('click', () => {
        const newPass = document.getElementById('profileNewPassword').value;
        if (!newPass) return;
        const users = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
        if (users[currentUser.email]) users[currentUser.email].password = newPass;
        localStorage.setItem('teamScheduleUsers', JSON.stringify(users));
        document.getElementById('profileNewPassword').value = '';
            alert('Password updated.');
        });
    }
    const profileSaveBtn = document.getElementById('profileSaveBtn');
    if (profileSaveBtn) profileSaveBtn.addEventListener('click', saveProfileAndClose);
    const profileAvatarBorderColorEl = document.getElementById('profileAvatarBorderColor');
    if (profileAvatarBorderColorEl) {
        profileAvatarBorderColorEl.addEventListener('input', () => {
            if (currentUser) {
                currentUser.avatarBorderColor = profileAvatarBorderColorEl.value;
                const users = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
                if (users[currentUser.email]) users[currentUser.email].avatarBorderColor = currentUser.avatarBorderColor;
                localStorage.setItem('teamScheduleUser', JSON.stringify(currentUser));
                localStorage.setItem('teamScheduleUsers', JSON.stringify(users));
                renderOnlineUsersStrip();
            }
        });
    }
    const profileSignOutBtn = document.getElementById('profileSignOutBtn');
    if (profileSignOutBtn) {
        profileSignOutBtn.addEventListener('click', () => {
            localStorage.removeItem('teamScheduleUser');
            currentUser = null;
            location.reload();
        });
    }

    // Settings modal (index.html)
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (!isAdminMode) {
                document.getElementById('adminModal').classList.add('show');
            } else {
                const settingsPage = document.getElementById('settingsPage');
                const dashboardPage = document.getElementById('dashboardPage');
                const scheduleView = document.getElementById('scheduleView');
                const onSettingsPage = settingsPage && settingsPage.style.display === 'flex';
                const onDashboardPage = dashboardPage && dashboardPage.style.display === 'flex';
                if (onSettingsPage || onDashboardPage) {
                    if (scheduleView) scheduleView.style.display = 'flex';
                    if (settingsPage) settingsPage.style.display = 'none';
                    if (dashboardPage) dashboardPage.style.display = 'none';
                    showScheduleBoardView();
                    return;
                }
                if (settingsPage && scheduleView) {
                    scheduleView.style.display = 'none';
                    settingsPage.style.display = 'flex';
                    renderSettings();
                    renderWorkblocksPerClient();
                    renderTimeTracking();
                } else if (dashboardPage && scheduleView) {
                    scheduleView.style.display = 'none';
                    dashboardPage.style.display = 'flex';
                    renderSettings();
                    renderWorkblocksPerClient();
                    renderTimeTracking();
                } else {
                    document.getElementById('settingsModal').classList.add('show');
                    renderSettings();
                    renderWorkblocksPerClient();
                    setTimeout(() => {
                        const leftCol = document.querySelector('.settings-left-column');
                        const rightCol = document.querySelector('.settings-right-column');
                        if (leftCol && rightCol) rightCol.style.maxHeight = leftCol.offsetHeight + 'px';
                    }, 50);
                }
            }
        });
    }
    const closeSettings = document.getElementById('closeSettings');
    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            syncLeadershipRatesFromSettingsForm();
            document.getElementById('settingsModal').classList.remove('show');
        });
    }

    // Admin modal close button
    document.getElementById('closeAdminModal').addEventListener('click', () => {
        document.getElementById('adminModal').classList.remove('show');
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminError').style.display = 'none';
    });

    // Admin login button
    document.getElementById('adminLoginBtn').addEventListener('click', () => {
        const password = document.getElementById('adminPassword').value;
        const errorMsg = document.getElementById('adminError');
        
        if (password === ADMIN_PASSWORD) {
            isAdminMode = true;
            saveData(); // Save admin mode to localStorage - will persist across sessions
            applyViewModeRestrictions();
            document.getElementById('adminModal').classList.remove('show');
            document.getElementById('adminPassword').value = '';
            errorMsg.style.display = 'none';
        } else {
            errorMsg.style.display = 'block';
            document.getElementById('adminPassword').value = '';
        }
    });

    // Enter key support for admin password
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('adminLoginBtn').click();
        }
    });

    // Mode indicator click to show admin modal or exit admin mode
    document.getElementById('modeIndicator').addEventListener('click', () => {
        if (!isAdminMode) {
            document.getElementById('adminModal').classList.add('show');
        } else {
            // Exit admin mode
            if (confirm('Exit Admin Mode?')) {
                isAdminMode = false;
                saveData(); // Save admin mode state - will persist across sessions
                applyViewModeRestrictions();
            }
        }
    });

    // Watermark click to show image modal
    document.querySelector('.watermark').addEventListener('click', () => {
        document.getElementById('watermarkModal').classList.add('show');
    });

    // Close watermark modal
    document.getElementById('closeWatermarkModal').addEventListener('click', () => {
        document.getElementById('watermarkModal').classList.remove('show');
    });

    // Client modal
    document.getElementById('closeClientModal').addEventListener('click', closeClientModal);
    document.getElementById('closeMemberModal').addEventListener('click', closeMemberModal);
    const closeEditMemberModalBtn = document.getElementById('closeEditMemberModal');
    if (closeEditMemberModalBtn) closeEditMemberModalBtn.addEventListener('click', () => { document.getElementById('editMemberModal').classList.remove('show'); editMemberState = { type: null, index: -1 }; });
    const editMemberSaveBtn = document.getElementById('editMemberSaveBtn');
    if (editMemberSaveBtn) editMemberSaveBtn.addEventListener('click', saveEditMemberAndClose);
    const closeClientDetail = document.getElementById('closeClientDetail');
    if (closeClientDetail) {
        closeClientDetail.addEventListener('click', () => saveProjectDetailAndClose());
    }
    initLeadershipReportButtons();
    
    // Leadership mode
    const leadershipBtn = document.getElementById('leadershipModeBtn');
    if (leadershipBtn) {
        leadershipBtn.addEventListener('click', toggleLeadershipMode);
    }
    
    // Leadership client modal
    const closeLeadershipClientModalBtn = document.getElementById('closeLeadershipClientModal');
    if (closeLeadershipClientModalBtn) {
        closeLeadershipClientModalBtn.addEventListener('click', closeLeadershipClientModal);
    }

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        const clientModal = document.getElementById('clientModal');
        const adminModal = document.getElementById('adminModal');
        const watermarkModal = document.getElementById('watermarkModal');
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && e.target === settingsModal) {
            syncLeadershipRatesFromSettingsForm();
            settingsModal.classList.remove('show');
        }
        if (e.target === clientModal) {
            closeClientModal();
        }
        const memberModal = document.getElementById('memberModal');
        if (e.target === memberModal) {
            closeMemberModal();
        }
        const leadershipClientModal = document.getElementById('leadershipClientModal');
        if (e.target === leadershipClientModal) {
            closeLeadershipClientModal();
        }
        const editMemberModal = document.getElementById('editMemberModal');
        if (editMemberModal && e.target === editMemberModal) {
            editMemberModal.classList.remove('show');
            editMemberState = { type: null, index: -1 };
        }
        const profileModal = document.getElementById('profileModal');
        const clientDetailModal = document.getElementById('clientDetailModal');
        if (e.target === profileModal) {
            profileModal.classList.remove('show');
        }
        if (clientDetailModal && e.target === clientDetailModal) {
            saveProjectDetailAndClose();
        }
        if (e.target === adminModal) {
            adminModal.classList.remove('show');
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminError').style.display = 'none';
        }
        if (e.target === watermarkModal) {
            watermarkModal.classList.remove('show');
        }
    });

    // Add member
    document.getElementById('addMemberBtn').addEventListener('click', () => {
        if (!isAdminMode) return;
        const input = document.getElementById('newMemberName');
        const name = input.value.trim();
        if (name && !teamMembers.find(m => m.name === name)) {
            saveStateToHistory();
            const defaultColors = ['#ce2828', '#4a90e2', '#50c878', '#ff6b6b', '#9b59b6', '#f39c12'];
            teamMembers.push({
                name: name,
                color: defaultColors[teamMembers.length % defaultColors.length],
                profilePicture: '',
                hourlyRate: null
            });
            saveData();
            renderSidebar();
            renderSettings();
            input.value = '';
        } else if (teamMembers.find(m => m.name === name)) {
            alert('Member already exists!');
        }
    });

    // Add leadership member
    const addLeadershipMemberBtn = document.getElementById('addLeadershipMemberBtn');
    if (addLeadershipMemberBtn) {
        addLeadershipMemberBtn.addEventListener('click', () => {
            if (!isAdminMode) return;
            const input = document.getElementById('newLeadershipMemberName');
            const name = input.value.trim();
            if (name && !leadershipMembers.find(m => m.name === name)) {
                saveStateToHistory();
                const defaultColors = ['#ce2828', '#4a90e2', '#50c878', '#ff6b6b', '#9b59b6', '#f39c12'];
                leadershipMembers.push({
                    name: name,
                    color: defaultColors[leadershipMembers.length % defaultColors.length],
                    profilePicture: '',
                    hourlyRate: null
                });
                saveData();
                renderSettings();
                if (isLeadershipMode) {
                    renderSidebar(); if (isLeadershipMode) updateStats();
                }
                input.value = '';
            } else if (leadershipMembers.find(m => m.name === name)) {
                alert('Leadership member already exists!');
            }
        });
    }

    // Add project (name = project name, client = same by default)
    const addProjectBtn = document.getElementById('addProjectBtn');
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', () => {
            if (!isAdminMode) return;
            const input = document.getElementById('newProjectName');
            const name = (input && input.value.trim()) ? input.value.trim() : '';
            if (!name) return;
            if (projects.some(p => p.clientName === name && p.name === name)) {
                alert('A project with that name already exists.');
                return;
            }
            saveStateToHistory();
            const defaultColors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
            projects.push({
                clientName: name,
                name: name,
                budget: null,
                color: defaultColors[projects.length % defaultColors.length]
            });
            clients = getDerivedClientsFromProjects();
            saveData();
            renderSidebar();
            renderSettings();
            if (input) input.value = '';
        });
    }

    // Keyboard shortcut for undo (Ctrl+Z); Escape closes settings after syncing leadership rates
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal && settingsModal.classList.contains('show')) {
                syncLeadershipRatesFromSettingsForm();
                settingsModal.classList.remove('show');
            }
            return;
        }
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        isDarkTheme = !isDarkTheme;
        applyTheme();
        saveData();
    });

    // Week navigation (local only - not synced across devices)
    document.getElementById('prevWeek').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        // Save to localStorage only (not to Supabase)
        saveCurrentWeekStartToLocalStorage(currentWeekStart);
        renderCalendar();
        updateWeekDisplay();
        updateDayHeaders();
        updateStats();
        renderTimeTracking();
        if (isLeadershipMode) {
            renderSidebar(); if (isLeadershipMode) updateStats();
        }
    });

    document.getElementById('nextWeek').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        // Save to localStorage only (not to Supabase)
        saveCurrentWeekStartToLocalStorage(currentWeekStart);
        renderCalendar();
        updateWeekDisplay();
        updateDayHeaders();
        updateStats();
        renderTimeTracking();
        if (isLeadershipMode) {
            renderSidebar(); if (isLeadershipMode) updateStats();
        }
    });

    const goToCurrentWeekBtn = document.getElementById('goToCurrentWeekBtn');
    if (goToCurrentWeekBtn) {
        goToCurrentWeekBtn.addEventListener('click', () => {
            currentWeekStart = getCurrentWeekMonday();
            saveCurrentWeekStartToLocalStorage(currentWeekStart);
            renderCalendar();
            updateWeekDisplay();
            updateDayHeaders();
            updateStats();
            renderTimeTracking();
            if (isLeadershipMode) {
                renderSidebar(); if (isLeadershipMode) updateStats();
            }
        });
    }

    // Enter key support for inputs
    document.getElementById('newMemberName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addMemberBtn').click();
        }
    });

    const newProjectNameEl = document.getElementById('newProjectName');
    if (newProjectNameEl) {
        newProjectNameEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const btn = document.getElementById('addProjectBtn');
                if (btn) btn.click();
            }
        });
    }
    
    // Time tracking week navigation (uses separate week tracking for settings modal)
    window.timeTrackingWeekStart = new Date(currentWeekStart);
    
    const timeTrackingPrevWeek = document.getElementById('timeTrackingPrevWeek');
    const timeTrackingNextWeek = document.getElementById('timeTrackingNextWeek');
    
    if (timeTrackingPrevWeek) {
        timeTrackingPrevWeek.addEventListener('click', () => {
            window.timeTrackingWeekStart.setDate(window.timeTrackingWeekStart.getDate() - 7);
            renderTimeTracking();
        });
    }
    
    if (timeTrackingNextWeek) {
        timeTrackingNextWeek.addEventListener('click', () => {
            window.timeTrackingWeekStart.setDate(window.timeTrackingWeekStart.getDate() + 7);
            renderTimeTracking();
        });
    }
    
    // Time tracking is now in sidebar, so it doesn't need to sync with settings opening
}

// Get Monday of the week containing the given date
function getCurrentWeekMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// Update week display
function updateWeekDisplay() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 4); // Monday to Friday (5 days)
    
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const startStr = currentWeekStart.toLocaleDateString('en-US', options);
    const endStr = weekEnd.toLocaleDateString('en-US', options);
    
    document.getElementById('weekDisplay').textContent = `${startStr} - ${endStr}`;
    
    // Show "Today" button when viewing a week that's not the current week
    const currentMonday = getCurrentWeekMonday();
    const viewingCurrentWeek = currentWeekStart.getTime() === currentMonday.getTime();
    const goBtn = document.getElementById('goToCurrentWeekBtn');
    if (goBtn) {
        goBtn.style.display = viewingCurrentWeek ? 'none' : 'inline-block';
    }
}

// Update member color
function updateMemberColor(index, color) {
    if (!isAdminMode) return;
    teamMembers[index].color = color;
    syncProductionMemberToLeadership(teamMembers[index].name, teamMembers[index]);
    saveData();
    renderSidebar();
    renderSettings();
    renderCalendar();
    updateStats();
    if (isLeadershipMode) {
        renderSidebar(); if (isLeadershipMode) updateStats();
    }
}

function updateMemberHourlyRate(index, value) {
    if (!isAdminMode) return;
    const num = value === '' || value === null ? null : parseFloat(value);
    teamMembers[index].hourlyRate = (num !== null && !isNaN(num) && num >= 0) ? num : null;
    syncProductionMemberToLeadership(teamMembers[index].name, teamMembers[index]);
    saveData();
    renderSettings();
    updateStats();
    if (isLeadershipMode) updateStats();
}

function updateLeadershipMemberHourlyRate(index, value) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:updateLeadershipMemberHourlyRate',message:'entry',data:{index,value:String(value),isAdminMode:!!isAdminMode},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    if (!isAdminMode) return;
    const num = value === '' || value === null ? null : parseFloat(value);
    leadershipMembers[index].hourlyRate = (num !== null && !isNaN(num) && num >= 0) ? num : null;
    saveData();
    renderSettings();
    if (isLeadershipMode) updateStats();
}

// Sync leadership rate inputs from the settings form into leadershipMembers and save (e.g. when closing settings).
function syncLeadershipRatesFromSettingsForm() {
    // #region agent log
    var _inputsFound = [];
    leadershipMembers.forEach((_, index) => {
        var el = document.getElementById('leadershipRate' + index);
        _inputsFound.push({ index: index, found: !!el, value: el ? el.value : null });
    });
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:syncLeadershipRatesFromSettingsForm',message:'entry',data:{isAdminMode:!!isAdminMode,leadershipCount:leadershipMembers.length,inputsFound:_inputsFound},timestamp:Date.now(),hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    if (!isAdminMode) return;
    let changed = false;
    leadershipMembers.forEach((member, index) => {
        const input = document.getElementById('leadershipRate' + index);
        if (!input) return;
        const raw = input.value;
        const num = raw === '' || raw === null ? null : parseFloat(raw);
        const newRate = (num !== null && !isNaN(num) && num >= 0) ? num : null;
        if (member.hourlyRate !== newRate) {
            member.hourlyRate = newRate;
            changed = true;
        }
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:syncLeadershipRatesFromSettingsForm',message:'after loop',data:{changed:!!changed,ratesNow:leadershipMembers.map(m=>m.hourlyRate)},timestamp:Date.now(),hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    if (changed) {
        saveData();
        if (isLeadershipMode) updateStats();
    }
}

// Update member profile picture
function updateMemberProfile(index, input) {
    if (!isAdminMode) return;
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            teamMembers[index].profilePicture = e.target.result;
            syncProductionMemberToLeadership(teamMembers[index].name, teamMembers[index]);
            saveData();
            renderSidebar();
            renderSettings();
            renderCalendar();
            if (isLeadershipMode) {
                renderSidebar(); if (isLeadershipMode) updateStats();
            }
        };
        reader.readAsDataURL(file);
    }
}

// Update client color
function updateClientColor(index, color) {
    if (!isAdminMode) return;
    clients[index].color = color;
    saveData();
    renderSidebar();
    renderCalendar();
    updateStats();
}

// Edit member (opens modal: name + rate)
function editMember(index) {
    openEditMemberModal('production', index);
}

// Delete member
function deleteMember(index) {
    if (!isAdminMode) return;
    saveStateToHistory();
    const memberName = teamMembers[index].name;
    teamMembers.splice(index, 1);
    
    // Remove all schedule entries with this member
    Object.keys(schedule).forEach(key => {
        if (Array.isArray(schedule[key])) {
            schedule[key] = schedule[key].filter(assignment => assignment.member !== memberName);
            if (schedule[key].length === 0) {
                delete schedule[key];
            }
        }
    });
    
    saveData();
    renderSidebar();
    renderSettings();
    renderCalendar();
    updateStats();
}

// Edit client
function editClient(index) {
    if (!isAdminMode) return;
    const newName = prompt('Enter new name:', clients[index].name);
    if (newName && newName.trim() && !clients.find(c => c.name === newName.trim())) {
        saveStateToHistory();
        const oldName = clients[index].name;
        clients[index].name = newName.trim();
        
        Object.keys(schedule).forEach(key => {
            if (Array.isArray(schedule[key])) {
                schedule[key].forEach(assignment => {
                    if (assignment.client === oldName) assignment.client = newName.trim();
                });
            }
        });
        Object.keys(leadershipSchedule).forEach(key => {
            if (Array.isArray(leadershipSchedule[key])) {
                leadershipSchedule[key].forEach(assignment => {
                    if (assignment.client === oldName) assignment.client = newName.trim();
                });
            }
        });
        
        saveData();
        renderSidebar();
        renderSettings();
        renderCalendar();
        updateStats();
    } else if (clients.find(c => c.name === newName.trim())) {
        alert('Client with this name already exists!');
    }
}

// Delete client
function deleteClient(index) {
    if (!isAdminMode) return;
    saveStateToHistory();
    const clientName = clients[index].name;
    clients.splice(index, 1);
    projects = projects.filter(p => p.clientName !== clientName);
    
    Object.keys(schedule).forEach(key => {
        if (Array.isArray(schedule[key])) {
            schedule[key] = schedule[key].filter(assignment => assignment.client !== clientName);
            if (schedule[key].length === 0) delete schedule[key];
        }
    });
    Object.keys(leadershipSchedule).forEach(key => {
        if (Array.isArray(leadershipSchedule[key])) {
            leadershipSchedule[key] = leadershipSchedule[key].filter(assignment => assignment.client !== clientName);
            if (leadershipSchedule[key].length === 0) delete leadershipSchedule[key];
        }
    });
    saveData();
    renderSidebar();
    renderSettings();
    renderCalendar();
    updateStats();
}

// Project detail modal (project name, client, budget, color)
let projectDetailEditingIndex = -1;

// Edit member modal: 'production' | 'leadership', index
let editMemberState = { type: null, index: -1 };

function openEditMemberModal(type, index) {
    if (!isAdminMode) return;
    const list = type === 'leadership' ? leadershipMembers : teamMembers;
    const member = list[index];
    if (!member) return;
    editMemberState = { type, index };
    document.getElementById('editMemberModalTitle').textContent = type === 'leadership' ? 'Edit leadership member' : 'Edit member';
    document.getElementById('editMemberName').value = member.name || '';
    document.getElementById('editMemberRate').value = member.hourlyRate != null && member.hourlyRate !== '' ? member.hourlyRate : '';
    document.getElementById('editMemberModal').classList.add('show');
}

function saveEditMemberAndClose() {
    if (editMemberState.type === null || editMemberState.index < 0) return;
    const nameEl = document.getElementById('editMemberName');
    const rateEl = document.getElementById('editMemberRate');
    const newName = (nameEl && nameEl.value.trim()) ? nameEl.value.trim() : '';
    const rateVal = rateEl && rateEl.value !== '' ? parseFloat(rateEl.value) : null;
    const newRate = (rateVal != null && !isNaN(rateVal) && rateVal >= 0) ? rateVal : null;

    const list = editMemberState.type === 'leadership' ? leadershipMembers : teamMembers;
    const current = list[editMemberState.index];
    if (!current) return;
    const nameToUse = newName || current.name;
    if (!nameToUse.trim()) {
        alert('Name is required.');
        return;
    }

    if (editMemberState.type === 'production') {
        const member = teamMembers[editMemberState.index];
        if (!member) return;
        const oldName = member.name;
        if (nameToUse !== oldName) {
            if (teamMembers.some(m => m !== member && m.name === nameToUse)) {
                alert('A member with that name already exists.');
                return;
            }
            saveStateToHistory();
            member.name = nameToUse;
            Object.keys(schedule).forEach(key => {
                if (Array.isArray(schedule[key])) {
                    schedule[key].forEach(a => { if (a && a.member === oldName) a.member = nameToUse; });
                }
            });
            syncProductionMemberToLeadership(oldName, member);
        }
        member.hourlyRate = newRate;
        syncProductionMemberToLeadership(member.name, member);
        saveData();
        renderSidebar();
        renderSettings();
        renderCalendar();
        updateStats();
    } else {
        const member = leadershipMembers[editMemberState.index];
        if (!member) return;
        const oldName = member.name;
        if (nameToUse !== oldName) {
            if (leadershipMembers.some(m => m !== member && m.name === nameToUse)) {
                alert('A leadership member with that name already exists.');
                return;
            }
            saveStateToHistory();
            member.name = nameToUse;
            Object.keys(schedule).forEach(key => {
                if (Array.isArray(schedule[key])) {
                    schedule[key].forEach(a => { if (a && a.member === oldName) a.member = nameToUse; });
                }
            });
            Object.keys(leadershipSchedule).forEach(key => {
                if (Array.isArray(leadershipSchedule[key])) {
                    leadershipSchedule[key].forEach(a => { if (a && a.member === oldName) a.member = nameToUse; });
                }
            });
        }
        member.hourlyRate = newRate;
        saveData();
        renderSettings();
        if (isLeadershipMode) { renderSidebar(); updateStats(); }
    }
    document.getElementById('editMemberModal').classList.remove('show');
    editMemberState = { type: null, index: -1 };
}

function openProjectDetail(projectIndex) {
    if (!isAdminMode) return;
    const project = projects[projectIndex];
    if (!project) return;
    projectDetailEditingIndex = projectIndex;
    document.getElementById('clientDetailTitle').textContent = 'Edit project';
    const nameEl = document.getElementById('projectDetailName');
    const clientEl = document.getElementById('projectDetailClient');
    const budgetEl = document.getElementById('projectDetailBudget');
    const colorEl = document.getElementById('projectDetailColor');
    if (nameEl) nameEl.value = project.name || '';
    if (clientEl) clientEl.value = project.clientName || project.name || '';
    if (budgetEl) budgetEl.value = project.budget != null ? project.budget : '';
    if (colorEl) colorEl.value = project.color || '#667eea';
    document.getElementById('clientDetailModal').classList.add('show');
}

function saveProjectDetailAndClose() {
    if (projectDetailEditingIndex < 0) return;
    const project = projects[projectDetailEditingIndex];
    if (!project) return;
    const nameEl = document.getElementById('projectDetailName');
    const clientEl = document.getElementById('projectDetailClient');
    const budgetEl = document.getElementById('projectDetailBudget');
    const colorEl = document.getElementById('projectDetailColor');
    const newName = (nameEl && nameEl.value.trim()) ? nameEl.value.trim() : project.name;
    const newClient = (clientEl && clientEl.value.trim()) ? clientEl.value.trim() : (project.clientName || project.name);
    const budgetVal = budgetEl && budgetEl.value !== '' ? parseFloat(budgetEl.value) : null;
    const newColor = (colorEl && colorEl.value) ? colorEl.value : (project.color || '#667eea');
    const oldName = project.name;
    const oldClient = project.clientName;
    saveStateToHistory();
    project.name = newName;
    project.clientName = newClient;
    project.budget = (budgetVal != null && !isNaN(budgetVal)) ? budgetVal : null;
    project.color = newColor;
    if (oldName !== newName || oldClient !== newClient) {
        Object.keys(schedule).forEach(key => {
            if (Array.isArray(schedule[key])) {
                schedule[key].forEach(a => {
                    if (a && a.client === oldClient && a.project === oldName) {
                        a.client = newClient;
                        a.project = newName;
                    }
                });
            }
        });
        Object.keys(leadershipSchedule).forEach(key => {
            if (Array.isArray(leadershipSchedule[key])) {
                leadershipSchedule[key].forEach(a => {
                    if (a && a.client === oldClient && a.project === oldName) {
                        a.client = newClient;
                        a.project = newName;
                    }
                });
            }
        });
    }
    clients = getDerivedClientsFromProjects();
    saveData();
    renderSidebar();
    renderSettings();
    renderCalendar();
    updateStats();
    document.getElementById('clientDetailModal').classList.remove('show');
    projectDetailEditingIndex = -1;
}

function updateProjectColor(index, color) {
    if (!isAdminMode) return;
    if (projects[index]) {
        projects[index].color = color;
        clients = getDerivedClientsFromProjects();
        saveData();
        renderSidebar();
        renderSettings();
        renderCalendar();
        updateStats();
    }
}

function deleteProject(index) {
    if (!isAdminMode) return;
    const project = projects[index];
    if (!project) return;
    saveStateToHistory();
    const clientName = project.clientName;
    const projectName = project.name;
    projects.splice(index, 1);
    Object.keys(schedule).forEach(key => {
        if (Array.isArray(schedule[key])) {
            schedule[key] = schedule[key].filter(a => !(a.client === clientName && a.project === projectName));
            if (schedule[key].length === 0) delete schedule[key];
        }
    });
    Object.keys(leadershipSchedule).forEach(key => {
        if (Array.isArray(leadershipSchedule[key])) {
            leadershipSchedule[key] = leadershipSchedule[key].filter(a => !(a.client === clientName && a.project === projectName));
            if (leadershipSchedule[key].length === 0) delete leadershipSchedule[key];
        }
    });
    clients = getDerivedClientsFromProjects();
    saveData();
    renderSidebar();
    renderSettings();
    renderCalendar();
    updateStats();
}

// Leadership Member functions
window.updateLeadershipMemberColor = function(index, color) {
    if (!isAdminMode) return;
    leadershipMembers[index].color = color;
    saveData();
    renderSettings();
    if (isLeadershipMode) {
        renderSidebar(); if (isLeadershipMode) updateStats();
    }
};

window.updateLeadershipMemberHourlyRate = function(index, value) {
    updateLeadershipMemberHourlyRate(index, value);
};

window.updateLeadershipMemberProfile = function(index, input) {
    if (!isAdminMode) return;
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            leadershipMembers[index].profilePicture = e.target.result;
            saveData();
            renderSettings();
            if (isLeadershipMode) {
                renderSidebar(); if (isLeadershipMode) updateStats();
            }
        };
        reader.readAsDataURL(file);
    }
};

window.editLeadershipMember = function(index) {
    openEditMemberModal('leadership', index);
};

window.deleteLeadershipMember = function(index) {
    if (!isAdminMode) return;
    saveStateToHistory();
    const memberName = leadershipMembers[index].name;
    leadershipMembers.splice(index, 1);
    
    Object.keys(leadershipSchedule).forEach(key => {
        if (Array.isArray(leadershipSchedule[key])) {
            leadershipSchedule[key] = leadershipSchedule[key].filter(assignment => assignment.member !== memberName);
            if (leadershipSchedule[key].length === 0) delete leadershipSchedule[key];
        }
    });
    saveData();
    renderSettings();
    if (isLeadershipMode) {
        renderSidebar();
        updateStats();
        renderAllLeadershipTimeEntries();
    }
    updateStats();
};

// Toggle Production Member to Leadership Members
window.toggleProductionMemberToLeadership = function(index, include) {
    if (!isAdminMode) return;
    
    const member = teamMembers[index];
    if (!member) return;
    
    saveStateToHistory();
    
    if (include) {
        // Add to leadership members if not already there
        if (!leadershipMembers.find(m => m.name === member.name)) {
            leadershipMembers.push({
                name: member.name,
                color: member.color,
                profilePicture: member.profilePicture,
                hourlyRate: member.hourlyRate != null ? member.hourlyRate : null
            });
        }
    } else {
        // Remove from leadership members (but keep in production members)
        const leadershipIndex = leadershipMembers.findIndex(m => m.name === member.name);
        if (leadershipIndex !== -1) {
            leadershipMembers.splice(leadershipIndex, 1);
        }
    }
    
    saveData();
    renderSettings();
    if (isLeadershipMode) {
        renderSidebar(); if (isLeadershipMode) updateStats();
    }
};

// Sync production member changes to leadership members if they're toggled
function syncProductionMemberToLeadership(oldName, newMember) {
    const leadershipIndex = leadershipMembers.findIndex(m => m.name === oldName);
    if (leadershipIndex !== -1) {
        // Update the leadership member with new data
        leadershipMembers[leadershipIndex] = {
            name: newMember.name,
            color: newMember.color,
            profilePicture: newMember.profilePicture
        };
    }
}

// Apply theme
function applyTheme() {
    document.body.classList.toggle('dark-theme', isDarkTheme);
    document.body.classList.toggle('bright-theme', !isDarkTheme);
}

// Apply admin mode class to body
function applyAdminModeClass() {
    if (isAdminMode) {
        document.body.classList.add('admin-mode');
    } else {
        document.body.classList.remove('admin-mode');
    }
}

// Highlight horizontal blocks (all days for a time block)
function highlightHorizontalBlocks(blockId) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    days.forEach((dayName, dayIdx) => {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIdx);
        const dayDateKey = formatDateKey(dayDate, dayName);
        const dayBlockKey = `${dayDateKey}-${blockId}`;
        
        // Find the time block element
        const calendarGrid = document.getElementById('calendarGrid');
        const dayColumns = calendarGrid.querySelectorAll('.day-column');
        if (dayColumns[dayIdx]) {
            const timeBlocks = dayColumns[dayIdx].querySelectorAll('.work-block');
            const timeBlockIndex = ['Work1', 'Work2', 'Work3'].indexOf(blockId);
            if (timeBlocks[timeBlockIndex]) {
                timeBlocks[timeBlockIndex].classList.add('highlight-clear');
            }
        }
    });
}

// Highlight vertical blocks (all time blocks for a day)
function highlightVerticalBlocks(dateKey) {
    const calendarGrid = document.getElementById('calendarGrid');
    const dayColumns = calendarGrid.querySelectorAll('.day-column');
    
    dayColumns.forEach((dayColumn, dayIdx) => {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIdx);
        const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][dayIdx];
        const dayDateKey = formatDateKey(dayDate, dayName);
        
        if (dayDateKey === dateKey) {
            const timeBlocks = dayColumn.querySelectorAll('.work-block');
            timeBlocks.forEach(block => {
                block.classList.add('highlight-clear');
            });
        }
    });
}

// Clear all highlights
function clearHighlights() {
    const calendarGrid = document.getElementById('calendarGrid');
    const highlightedBlocks = calendarGrid.querySelectorAll('.highlight-clear');
    highlightedBlocks.forEach(block => {
        block.classList.remove('highlight-clear');
    });
}

// Show add block modal
function showAddBlockModal() {
    if (!isAdminMode) return;
    const startTime = prompt('Enter start time (e.g., 9:00 AM):');
    if (!startTime) return;
    
    const endTime = prompt('Enter end time (e.g., 11:00 AM):');
    if (!endTime) return;
    
    const label = prompt('Enter block label (e.g., Work Block 4):', 'Work Block');
    if (!label) return;
    
    // Convert time to 24-hour format for storage
    const start24 = convertTo24Hour(startTime);
    const end24 = convertTo24Hour(endTime);
    
    if (!start24 || !end24) {
        alert('Invalid time format. Please use format like "9:00 AM" or "14:00"');
        return;
    }
    
    saveStateToHistory();
    
    const newBlock = {
        id: `Work${Date.now()}`,
        label: label,
        time: `${formatTimeDisplay(startTime)} - ${formatTimeDisplay(endTime)}`,
        startTime: start24,
        endTime: end24,
        isLunch: false
    };
    
    timeBlocks.push(newBlock);
    saveData();
    renderCalendar();
}

// Delete time block
function deleteTimeBlock(blockIndex) {
    if (!isAdminMode) return;
    const block = timeBlocks[blockIndex];
    if (block.isLunch) {
        alert('Lunch time cannot be deleted.');
        return;
    }
    
    if (timeBlocks.length <= 1) {
        alert('You must have at least one time block.');
        return;
    }
    
    if (!confirm(`Delete "${block.label}" (${block.time})? All assignments in this time block will be removed.`)) {
        return;
    }
    
    saveStateToHistory();
    
    const blockId = block.id;
    
    // Remove all schedule entries for this time block
    Object.keys(schedule).forEach(key => {
        if (key.includes(`-${blockId}`)) {
            delete schedule[key];
        }
    });
    
    // Remove the time block
    timeBlocks.splice(blockIndex, 1);
    
    saveData();
    renderCalendar();
    updateStats();
}

// Edit time block
function editTimeBlock(blockIndex) {
    if (!isAdminMode) return;
    const block = timeBlocks[blockIndex];
    if (block.isLunch) {
        alert('Lunch time cannot be edited. You can delete and recreate it if needed.');
        return;
    }
    
    const newStartTime = prompt('Enter new start time (e.g., 9:00 AM):', convertFrom24Hour(block.startTime));
    if (!newStartTime) return;
    
    const newEndTime = prompt('Enter new end time (e.g., 11:00 AM):', convertFrom24Hour(block.endTime));
    if (!newEndTime) return;
    
    const newLabel = prompt('Enter new label:', block.label);
    if (!newLabel) return;
    
    const start24 = convertTo24Hour(newStartTime);
    const end24 = convertTo24Hour(newEndTime);
    
    if (!start24 || !end24) {
        alert('Invalid time format. Please use format like "9:00 AM" or "14:00"');
        return;
    }
    
    saveStateToHistory();
    
    timeBlocks[blockIndex].time = `${formatTimeDisplay(newStartTime)} - ${formatTimeDisplay(newEndTime)}`;
    timeBlocks[blockIndex].startTime = start24;
    timeBlocks[blockIndex].endTime = end24;
    timeBlocks[blockIndex].label = newLabel;
    
    saveData();
    renderCalendar();
}

// Convert time to 24-hour format
function convertTo24Hour(timeStr) {
    timeStr = timeStr.trim().toUpperCase();
    const isPM = timeStr.includes('PM');
    const isAM = timeStr.includes('AM');
    
    // Remove AM/PM
    timeStr = timeStr.replace(/[AP]M/gi, '').trim();
    
    const parts = timeStr.split(':');
    if (parts.length !== 2) return null;
    
    let hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    
    if (isNaN(hours) || isNaN(minutes)) return null;
    
    if (isPM && hours !== 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Convert from 24-hour to 12-hour format
function convertFrom24Hour(time24) {
    const parts = time24.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    
    return `${displayHours}:${minutes} ${period}`;
}

// Format time for display
function formatTimeDisplay(timeStr) {
    // If already in 12-hour format, return as is
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
        return timeStr;
    }
    // Otherwise convert from 24-hour
    return convertFrom24Hour(timeStr);
}

// Helper: get hourly rate for a member name (production or leadership).
function getMemberHourlyRate(memberName) {
    const m = teamMembers.find(x => x.name === memberName) || leadershipMembers.find(x => x.name === memberName);
    return (m && m.hourlyRate != null && !isNaN(m.hourlyRate)) ? Number(m.hourlyRate) : 0;
}

// Aggregate hours and cost by client and by project for a given week (weekStart = Monday) or all time (weekStart = null).
function aggregateHoursAndCostByClientAndProject(weekStart) {
    const byClient = {};
    const byProject = {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weekStartTime = weekStart ? new Date(weekStart).setHours(0, 0, 0, 0) : null;
    const weekEndTime = weekStart ? weekStartTime + 5 * 24 * 60 * 60 * 1000 : null;
    // #region agent log
    var _logAssignmentsWithoutProject = 0;
    var _logKeysInRangeProd = 0;
    var _logKeysInRangeLead = 0;
    var _logAssignmentsWithProject = 0;
    // #endregion

    function addToClient(clientName, hours, cost) {
        if (!byClient[clientName]) byClient[clientName] = { hours: 0, cost: 0 };
        byClient[clientName].hours += hours;
        byClient[clientName].cost += cost;
    }
    function addToProject(clientName, projectName, hours, cost) {
        const key = clientName + '|' + projectName;
        if (!byProject[key]) {
            const proj = projects.find(p => p.clientName === clientName && p.name === projectName);
            byProject[key] = { clientName, projectName, hours: 0, cost: 0, budget: proj && proj.budget != null ? proj.budget : null };
        }
        byProject[key].hours += hours;
        byProject[key].cost += cost;
    }
    function keyInRange(blockKey) {
        if (!weekStartTime) return true;
        const parts = blockKey.split('-');
        if (parts.length < 4) return false;
        const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
        const keyDate = new Date(y, m, d).getTime();
        return keyDate >= weekStartTime && keyDate < weekEndTime;
    }

    // Production schedule
    Object.keys(schedule).forEach(blockKey => {
        var inRange = keyInRange(blockKey);
        if (inRange) _logKeysInRangeProd++;
        if (!inRange) return;
        const assignments = schedule[blockKey] || [];
        const dateKey = blockKey.split('-').slice(0, 4).join('-');
        const blockId = blockKey.slice(dateKey.length + 1);
        const block = timeBlocks.find(b => b.id === blockId);
        const blockHours = block && !block.isLunch ? (parseInt(block.endTime.split(':')[0], 10) - parseInt(block.startTime.split(':')[0], 10)) : 0;
        if (blockHours <= 0) return;
        assignments.forEach(a => {
            if (!a || !a.member || !a.client) return;
            if (!a.project) _logAssignmentsWithoutProject++; else _logAssignmentsWithProject++;
            const rate = getMemberHourlyRate(a.member);
            const cost = blockHours * rate;
            addToClient(a.client, blockHours, cost);
            addToProject(a.client, a.project || a.client, blockHours, cost);
        });
    });
    // Leadership schedule
    Object.keys(leadershipSchedule).forEach(blockKey => {
        var inRange = keyInRange(blockKey);
        if (inRange) _logKeysInRangeLead++;
        if (!inRange) return;
        const parts = blockKey.split('-leadership-');
        if (parts.length < 2) return;
        const suffix = parts[1];
        const numParts = suffix.split('-').map(Number);
        if (numParts.length < 2) return;
        const blockHours = (numParts[1] - numParts[0]) / 60;
        const assignments = leadershipSchedule[blockKey] || [];
        assignments.forEach(a => {
            if (!a || !a.member || !a.client) return;
            if (!a.project) _logAssignmentsWithoutProject++; else _logAssignmentsWithProject++;
            const rate = getMemberHourlyRate(a.member);
            const cost = blockHours * rate;
            addToClient(a.client, blockHours, cost);
            addToProject(a.client, a.project || a.client, blockHours, cost);
        });
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec7ef1a8-7389-4213-a659-4b03335bac18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:aggregateHoursAndCostByClientAndProject',message:'exit',data:{weekStart:weekStart?weekStart.toISOString():null,byClientKeys:Object.keys(byClient).length,byProjectKeys:Object.keys(byProject).length,assignmentsWithoutProject:_logAssignmentsWithoutProject,assignmentsWithProject:_logAssignmentsWithProject,keysInRangeProd:_logKeysInRangeProd,keysInRangeLead:_logKeysInRangeLead},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return { byClient, byProject };
}

// Calculate and update statistics
function updateStats() {
    const personHours = {};
    const personCost = {};
    const clientHours = {};
    const clientCost = {};
    
    // Calculate hours per block dynamically from timeBlocks
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Initialize counters (production + leadership members for person hours)
    teamMembers.forEach(member => {
        personHours[member.name] = 0;
        personCost[member.name] = 0;
    });
    leadershipMembers.forEach(member => {
        if (!personHours.hasOwnProperty(member.name)) {
            personHours[member.name] = 0;
            personCost[member.name] = 0;
        }
    });
    
    clients.forEach(client => {
        clientHours[client.name] = 0;
        clientCost[client.name] = 0;
    });
    
    // Count hours and cost from schedule - ONLY for the current week
    days.forEach((day, dayIndex) => {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIndex);
        const dateKey = formatDateKey(dayDate, day);
        
        timeBlocks.forEach((block) => {
            if (block.isLunch) return;
            if (block.id.startsWith('leadership-')) return;
            const blockKey = `${dateKey}-${block.id}`;
            const assignments = schedule[blockKey] || [];
            const startHour = parseInt(block.startTime.split(':')[0]);
            const endHour = parseInt(block.endTime.split(':')[0]);
            const blockHours = endHour - startHour;
            if (Array.isArray(assignments)) {
                assignments.forEach(assignment => {
                    if (!assignment || !assignment.member || !assignment.client) return;
                    const rate = getMemberHourlyRate(assignment.member);
                    personHours[assignment.member] = (personHours[assignment.member] || 0) + blockHours;
                    personCost[assignment.member] = (personCost[assignment.member] || 0) + blockHours * rate;
                    if (clientHours.hasOwnProperty(assignment.client)) {
                        clientHours[assignment.client] += blockHours;
                        clientCost[assignment.client] += blockHours * rate;
                    }
                });
            }
        });
    });

    // Leadership hours from leadershipSchedule: merge into personHours and clientHours
    Object.keys(leadershipSchedule).forEach((key) => {
        const parts = key.split('-leadership-');
        if (parts.length < 2) return;
        const suffix = parts[1];
        const numParts = suffix.split('-').map(Number);
        if (numParts.length < 2) return;
        const startMinutes = numParts[0];
        const endMinutes = numParts[1];
        const blockHours = (endMinutes - startMinutes) / 60;
        const assignments = leadershipSchedule[key] || [];
        assignments.forEach(assignment => {
            if (!assignment || !assignment.member || !assignment.client) return;
            const rate = getMemberHourlyRate(assignment.member);
            personHours[assignment.member] = (personHours[assignment.member] || 0) + blockHours;
            personCost[assignment.member] = (personCost[assignment.member] || 0) + blockHours * rate;
            if (clientHours.hasOwnProperty(assignment.client)) {
                clientHours[assignment.client] += blockHours;
                clientCost[assignment.client] += blockHours * rate;
            } else {
                clientHours[assignment.client] = blockHours;
                clientCost[assignment.client] = blockHours * rate;
            }
        });
    });
    
    // Render person stats (production + leadership combined) - hours only, no cost on home
    const personStatsDiv = document.getElementById('personStats');
    if (personStatsDiv) {
        personStatsDiv.innerHTML = '';
        const sortedPersons = Object.entries(personHours)
            .filter(([, h]) => h > 0)
            .sort((a, b) => b[1] - a[1]);
        sortedPersons.forEach(([name, hours]) => {
            const statItem = document.createElement('div');
            statItem.className = 'stat-item';
            const member = teamMembers.find(m => m.name === name) || leadershipMembers.find(m => m.name === name);
            const color = member ? member.color : '#ce2828';
            statItem.innerHTML = `
                <div class="stat-color" style="background-color: ${color}"></div>
                <span class="stat-name">${name}</span>
                <span class="stat-value">${Math.round(hours)}h</span>
            `;
            personStatsDiv.appendChild(statItem);
        });
    }
    
    // Render client stats (production + leadership combined) - hours only, no cost on home
    const clientStatsDiv = document.getElementById('clientStats');
    if (clientStatsDiv) {
        clientStatsDiv.innerHTML = '';
        const sortedClients = Object.entries(clientHours)
            .filter(([, h]) => h > 0)
            .sort((a, b) => b[1] - a[1]);
        sortedClients.forEach(([name, hours]) => {
            const statItem = document.createElement('div');
            statItem.className = 'stat-item';
            const client = clients.find(c => c.name === name);
            const color = client ? client.color : '#667eea';
            statItem.innerHTML = `
                <div class="stat-color" style="background-color: ${color}"></div>
                <span class="stat-name">${name}</span>
                <span class="stat-value">${Math.round(hours)}h</span>
            `;
            clientStatsDiv.appendChild(statItem);
        });
    }
}

// Update mode indicator
function updateModeIndicator() {
    const indicator = document.getElementById('modeIndicator');
    if (indicator) {
        indicator.textContent = isAdminMode ? 'Admin Mode' : 'View Mode';
        indicator.className = isAdminMode ? 'mode-indicator admin' : 'mode-indicator view';
    }
}

// Apply view mode restrictions
function applyViewModeRestrictions() {
    // Disable/enable draggable items
    renderSidebar();
    
    // Hide/show edit controls in settings
    renderSettings();
    
    // Disable/enable calendar interactions
    renderCalendar();
    
    // Update mode indicator
    updateModeIndicator();
    
    // Apply admin mode class to body
    applyAdminModeClass();
}

// Leadership Mode
let isLeadershipMode = false;
// Actual calendar date for leadership view (prev/next move by 1 day through the year)
let currentLeadershipDate = null; // Date; null = use today and persist
let leadershipDragState = null; // { memberIndex, startMinutes, startY, currentMinutes, isDragging }
let leadershipMouseDownState = null; // { time, y, timeout }
let leadershipEditingEntry = null; // { entry, blockKey, assignment, memberIndex }
let leadershipResizeState = null; // { entry, isTop, startY, startMinutes }

// Show the correct schedule board: main calendar (production) or leadership-only board.
function showScheduleBoardView() {
    const calendarView = document.getElementById('calendarView');
    const leadershipView = document.getElementById('leadershipView');
    if (!calendarView || !leadershipView) return;
    if (isLeadershipMode) {
        calendarView.style.display = 'none';
        leadershipView.style.display = 'flex';
        renderLeadershipMode();
    } else {
        calendarView.style.display = '';
        leadershipView.style.display = 'none';
    }
}

// Toggle leadership mode: switches to leadership-only board (no production tasks) or back to main calendar.
function toggleLeadershipMode() {
    isLeadershipMode = !isLeadershipMode;
    const leadershipBtn = document.getElementById('leadershipModeBtn');
    if (leadershipBtn) {
        leadershipBtn.textContent = isLeadershipMode ? '👥 Production Members' : '👥 Leadership Members';
        leadershipBtn.classList.toggle('active', isLeadershipMode);
    }
    renderSidebar();
    updateStats();
    showScheduleBoardView();
}

// Leadership-only board: one column per leadership member; only their tasks are shown (no production members).
function renderLeadershipMode() {
    if (!isLeadershipMode) return;
    
    const timeHeader = document.querySelector('.leadership-time-header');
    const membersHeader = document.getElementById('leadershipMembersHeader');
    const timeColumn = document.getElementById('leadershipTimeColumn');
    const grid = document.getElementById('leadershipGrid');

    // Day nav: calendar date (prev/next = previous/next day), label shows "Today" when today + day number
    const dayLabelEl = document.getElementById('leadershipDayLabel');
    const dayPrevBtn = document.getElementById('leadershipDayPrev');
    const dayNextBtn = document.getElementById('leadershipDayNext');

    function updateLeadershipDayLabel() {
        if (!dayLabelEl) return;
        const d = getCurrentLeadershipDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = isSameCalendarDay(d, today);
        const dayNum = d.getDate();
        const dayText = isToday ? 'Today' : getDayNameFromDate(d);
        dayLabelEl.textContent = `${dayText} ${dayNum}`;
        dayLabelEl.classList.toggle('today', isToday);
    }

    updateLeadershipDayLabel();
    if (dayPrevBtn) {
        dayPrevBtn.onclick = () => {
            const d = getCurrentLeadershipDate();
            d.setDate(d.getDate() - 1);
            setCurrentLeadershipDate(d);
            updateLeadershipDayLabel();
            renderAllLeadershipTimeEntries();
        };
    }
    if (dayNextBtn) {
        dayNextBtn.onclick = () => {
            const d = getCurrentLeadershipDate();
            d.setDate(d.getDate() + 1);
            setCurrentLeadershipDate(d);
            updateLeadershipDayLabel();
            renderAllLeadershipTimeEntries();
        };
    }
    
    // Time header stays empty (spacer for grid alignment)
    if (timeHeader) timeHeader.innerHTML = '';
    membersHeader.innerHTML = '';
    timeColumn.innerHTML = '';
    grid.innerHTML = '';
    
    // Generate hour-by-hour time slots (8 AM to 8 PM)
    const hours = [];
    for (let h = 8; h <= 20; h++) {
        const hour12 = h > 12 ? h - 12 : h;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hourStr = `${hour12}:00 ${ampm}`;
        hours.push({ hour: h, display: hourStr });
    }
    
    // Render time column
    hours.forEach(({ hour, display }) => {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'leadership-hour-slot';
        timeSlot.textContent = display;
        timeColumn.appendChild(timeSlot);
    });
    
    // Render member headers and columns (use leadershipMembers in leadership mode)
    const membersToShow = isLeadershipMode ? leadershipMembers : teamMembers;
    membersToShow.forEach((member, memberIndex) => {
        // Header
        const memberHeader = document.createElement('div');
        memberHeader.className = 'leadership-member-header';
        const profileDisplay = member.profilePicture ? 
            `<img src="${member.profilePicture}" alt="${member.name}" class="draggable-item-profile circular" style="background-color: ${member.color}; width: 30px; height: 30px; object-fit: cover; border-radius: 50%;">` :
            `<div class="draggable-item-profile circular" style="background-color: ${member.color}; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: ${getContrastTextColor(member.color)}; font-weight: bold; font-size: 0.9rem;">${member.name.charAt(0).toUpperCase()}</div>`;
        memberHeader.innerHTML = `${profileDisplay}<span>${member.name}</span>`;
        membersHeader.appendChild(memberHeader);
        
        // Column
        const memberColumn = document.createElement('div');
        memberColumn.className = 'leadership-member-column';
        memberColumn.dataset.memberIndex = memberIndex;
        
        // Allow placement in leadership view when admin or when viewing leadership calendar
        const canEditLeadership = isAdminMode || isLeadershipMode;

        // Add global mouse handlers for this column (minute-based)
        memberColumn.addEventListener('mousedown', (e) => {
            if (!canEditLeadership) return;
            // Check if clicking on resize handle
            if (e.target.classList.contains('leadership-time-entry-resize-handle')) {
                const entry = e.target.closest('.leadership-time-entry');
                if (entry && entry.dataset.blockKey && !entry.classList.contains('leadership-drag-preview')) {
                    e.preventDefault();
                    e.stopPropagation();
                    leadershipResizeState = {
                        entry: entry,
                        isTop: e.target.classList.contains('top'),
                        startY: e.clientY,
                        startMinutes: parseInt(entry.dataset.startMinutes),
                        endMinutes: parseInt(entry.dataset.endMinutes),
                        memberIndex: memberIndex
                    };
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp, { once: true });
                    return;
                }
            }
            // Don't start create-flow when interacting with an entry (edit, delete, or drag)
            if (e.target.closest('.leadership-time-entry')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            const columnRect = memberColumn.getBoundingClientRect();
            const relativeY = e.clientY - columnRect.top;
            // Convert pixels to minutes: column top = 8:00 AM (480), 60px per hour so 1px = 1 min from 8am
            const startMinutes = Math.max(480, Math.min(1200, 480 + Math.round(relativeY)));
            
            // Start drag immediately
            leadershipDragState = {
                memberIndex: memberIndex,
                startMinutes: startMinutes,
                startY: e.clientY,
                currentMinutes: startMinutes,
                isDragging: false // Will be set to true when mouse moves
            };
            
            leadershipMouseDownState = {
                time: Date.now(),
                y: e.clientY,
                startMinutes: startMinutes,
                memberIndex: memberIndex
            };
            
            // Visual feedback and document listeners so drag always works
            memberColumn.style.cursor = 'ns-resize';
            updateLeadershipDragPreview();
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp, { once: true });
        });
        
        // Add global mouse handlers for drag (on document to catch mouseup outside column)
        const handleMouseMove = (e) => {
            // Handle resize
            if (leadershipResizeState && leadershipResizeState.memberIndex === memberIndex) {
                const columnRect = memberColumn.getBoundingClientRect();
                const relativeY = e.clientY - columnRect.top;
                const newMinutes = Math.max(480, Math.min(1200, 480 + Math.round(relativeY)));
                
                if (leadershipResizeState.isTop) {
                    if (newMinutes < leadershipResizeState.endMinutes) {
                        leadershipResizeState.entry.dataset.startMinutes = newMinutes;
                        updateLeadershipEntryPosition(leadershipResizeState.entry);
                    }
                } else {
                    if (newMinutes > leadershipResizeState.startMinutes) {
                        leadershipResizeState.entry.dataset.endMinutes = newMinutes;
                        updateLeadershipEntryPosition(leadershipResizeState.entry);
                    }
                }
                return;
            }
            
            // Handle drag
            if (leadershipDragState && leadershipDragState.memberIndex === memberIndex) {
                const columnRect = memberColumn.getBoundingClientRect();
                const relativeY = e.clientY - columnRect.top;
                const newMinutes = Math.max(480, Math.min(1200, 480 + Math.round(relativeY)));
                
                // Mark as dragging if mouse has moved
                if (Math.abs(newMinutes - leadershipDragState.startMinutes) > 2) {
                    leadershipDragState.isDragging = true;
                }
                
                if (newMinutes !== leadershipDragState.currentMinutes) {
                    leadershipDragState.currentMinutes = newMinutes;
                    updateLeadershipDragPreview();
                }
            }
        };
        
        const handleMouseUp = (e) => {
            // Handle resize end
            if (leadershipResizeState && leadershipResizeState.memberIndex === memberIndex) {
                const entry = leadershipResizeState.entry;
                const startMinutes = parseInt(entry.dataset.startMinutes);
                const endMinutes = parseInt(entry.dataset.endMinutes);
                saveLeadershipTimeEntry(entry.dataset.blockKey, entry.dataset.assignmentIndex, startMinutes, endMinutes);
                leadershipResizeState = null;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                return;
            }
            
            // Handle drag end: create block spanning the full dragged range
            if (leadershipDragState && leadershipDragState.memberIndex === memberIndex) {
                const start = leadershipDragState.startMinutes;
                const end = leadershipDragState.currentMinutes;
                const finalStart = Math.max(480, Math.min(start, end));
                let finalEnd = Math.min(1200, Math.max(start, end));
                const minDuration = 15;
                if (finalEnd - finalStart < minDuration) finalEnd = Math.min(1200, finalStart + minDuration);
                document.querySelectorAll('.leadership-drag-preview').forEach(el => el.remove());
                if (finalEnd > finalStart) {
                    showLeadershipClientModal(memberIndex, finalStart, finalEnd);
                }
                
                // Cleanup
                leadershipDragState = null;
                leadershipMouseDownState = null;
                document.querySelectorAll('.leadership-hour-cell').forEach(cell => {
                    cell.classList.remove('leadership-dragging');
                    cell.style.backgroundColor = '';
                });
                memberColumn.style.cursor = '';
                memberColumn.style.backgroundColor = '';
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };
        
        // Handle mouse leave to clean up resize
        memberColumn.addEventListener('mouseleave', () => {
            if (leadershipResizeState && leadershipResizeState.memberIndex === memberIndex) {
                const entry = leadershipResizeState.entry;
                const startMinutes = parseInt(entry.dataset.startMinutes);
                const endMinutes = parseInt(entry.dataset.endMinutes);
                saveLeadershipTimeEntry(entry.dataset.blockKey, entry.dataset.assignmentIndex, startMinutes, endMinutes);
                leadershipResizeState = null;
            }
        });
        
        // Create hour cells (for visual reference, but we use minute-based positioning)
        hours.forEach(({ hour }) => {
            const hourCell = document.createElement('div');
            hourCell.className = 'leadership-hour-cell';
            hourCell.dataset.memberIndex = memberIndex;
            hourCell.dataset.hour = hour;
            
            memberColumn.appendChild(hourCell);
        });

        // Make column accept drop from sidebar (drag member onto this column) and from leadership entries (move/duplicate)
        memberColumn.addEventListener('dragover', (e) => {
            if (!canEditLeadership) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = e.shiftKey ? 'copy' : 'move';
            memberColumn.classList.add('drag-over');
        });
        memberColumn.addEventListener('dragleave', () => {
            memberColumn.classList.remove('drag-over');
        });
        memberColumn.addEventListener('drop', (e) => {
            if (!canEditLeadership) return;
            e.preventDefault();
            memberColumn.classList.remove('drag-over');
            const data = e.dataTransfer.getData('text/plain');
            const columnRect = memberColumn.getBoundingClientRect();
            const relativeY = e.clientY - columnRect.top;
            const startMinutes = Math.max(480, Math.min(1140, 480 + Math.round(relativeY))); // 1140 so +60 <= 1200
            let endMinutes = startMinutes + 60;

            try {
                const parsed = JSON.parse(data);
                if (parsed && parsed.type === 'leadership-entry') {
                    const duration = Math.max(15, Math.min(720, parseInt(parsed.durationMinutes, 10) || 60));
                    endMinutes = Math.min(1200, startMinutes + duration);
                    if (e.shiftKey) {
                        duplicateLeadershipEntry(parsed.blockKey, parsed.assignmentIndex, memberIndex, startMinutes, endMinutes);
                    } else {
                        moveLeadershipEntry(parsed.blockKey, parsed.assignmentIndex, memberIndex, startMinutes, endMinutes);
                    }
                    return;
                }
            } catch (_) {}
            if (!data || !data.startsWith('member:')) return;
            const memberName = data.replace(/^member:/, '');
            const membersToUse = isLeadershipMode ? leadershipMembers : teamMembers;
            const dropMemberIndex = membersToUse.findIndex(m => m.name === memberName);
            if (dropMemberIndex === -1) return;
            showLeadershipClientModal(dropMemberIndex, startMinutes, endMinutes);
        });
        
        grid.appendChild(memberColumn);
    });
    
    // Render existing time entries
    renderAllLeadershipTimeEntries();
}

// Update drag preview (minute-based). Shows block spanning dragged range.
function updateLeadershipDragPreview() {
    document.querySelectorAll('.leadership-drag-preview').forEach(el => el.remove());
    if (!leadershipDragState) return;
    const { memberIndex, startMinutes, currentMinutes } = leadershipDragState;
    const start = Math.max(480, Math.min(startMinutes, currentMinutes));
    let end = Math.min(1200, Math.max(startMinutes, currentMinutes));
    if (end - start < 15) end = Math.min(1200, start + 15);
    const duration = end - start;
    const memberColumn = document.querySelector(`.leadership-member-column[data-member-index="${memberIndex}"]`);
    if (!memberColumn) return;
    const preview = document.createElement('div');
    preview.className = 'leadership-time-entry leadership-drag-preview';
    preview.style.top = `${start - 480}px`;
    preview.style.height = `${duration}px`;
    preview.style.background = 'rgba(100, 200, 255, 0.5)';
    preview.style.border = '2px dashed rgba(100, 200, 255, 0.8)';
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    preview.textContent = hours > 0 ? `${hours}h ${mins}m` : `${duration}m`;
    memberColumn.appendChild(preview);
}

// Update entry position after resize
function updateLeadershipEntryPosition(entry) {
    const startMinutes = parseInt(entry.dataset.startMinutes);
    const endMinutes = parseInt(entry.dataset.endMinutes);
    const duration = endMinutes - startMinutes;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    entry.style.top = `${startMinutes - 480}px`;
    entry.style.height = `${duration}px`;
    entry.querySelector('span').textContent = entry.dataset.clientName + ' (' + durationText + ')';
}

// Render time entries for a specific hour
function renderLeadershipTimeEntries(column, memberIndex, hour) {
    // This will be called for each hour cell
    // We'll render all entries in renderAllLeadershipTimeEntries
}

// Helper: render one leadership assignment into a member column (variable length; top/bottom resize handles when editable).
function renderOneLeadershipEntry(memberColumn, blockKey, assignment, assignmentIdx, startMinutes, endMinutes) {
    const duration = endMinutes - startMinutes;
    const client = clients.find(c => c.name === assignment.client);
    const entry = document.createElement('div');
    entry.className = 'leadership-time-entry';
    if (isAdminMode || isLeadershipMode) entry.classList.add('editable');
    entry.style.backgroundColor = client ? client.color : '#667eea';
    entry.style.top = `${startMinutes - 480}px`;
    entry.style.height = `${duration}px`;
    entry.dataset.blockKey = blockKey;
    entry.dataset.assignmentIndex = assignmentIdx;
    entry.dataset.startMinutes = startMinutes;
    entry.dataset.endMinutes = endMinutes;
    entry.dataset.clientName = assignment.client;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    const canEdit = isAdminMode || isLeadershipMode;
    const resizeHandles = canEdit ? '<div class="leadership-time-entry-resize-handle top" title="Drag to change start time"></div><div class="leadership-time-entry-resize-handle bottom" title="Drag to extend or shorten"></div>' : '';
    entry.innerHTML = `
        ${resizeHandles}
        <span>${assignment.client} (${durationText})</span>
        ${canEdit ? '<button type="button" class="leadership-time-entry-delete" title="Delete">&times;</button>' : ''}
    `;
    if (canEdit) {
        entry.draggable = true;
        entry.setAttribute('title', 'Drag to move, Shift+drag to duplicate');
        entry.addEventListener('dragstart', (ev) => {
            const duration = endMinutes - startMinutes;
            ev.dataTransfer.setData('text/plain', JSON.stringify({
                type: 'leadership-entry',
                blockKey: blockKey,
                assignmentIndex: assignmentIdx,
                durationMinutes: duration
            }));
            ev.dataTransfer.effectAllowed = 'copyMove';
            entry.classList.add('leadership-dragging');
        });
        entry.addEventListener('dragend', () => {
            entry.classList.remove('leadership-dragging');
            window._leadershipEntryDragJustEnded = true;
            setTimeout(() => { window._leadershipEntryDragJustEnded = false; }, 150);
        });
        entry.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (window._leadershipEntryDragJustEnded) return;
            if (ev.target.closest('.leadership-time-entry-delete')) {
                deleteLeadershipTimeEntry(ev, entry.dataset.blockKey, parseInt(entry.dataset.assignmentIndex, 10));
                return;
            }
            showLeadershipEditModal(entry);
        });
    }
    memberColumn.appendChild(entry);
}

// Render all time entries for the leadership (hourly) view. Uses both timeBlocks and direct schedule keys
// so that hourly leadership entries always show even if the block list differs.
// Only renders the currently selected calendar day (currentLeadershipDate) so placement matches creation.
function renderAllLeadershipTimeEntries() {
    document.querySelectorAll('.leadership-time-entry:not(.leadership-drag-preview)').forEach(el => el.remove());

    const membersToSearch = isLeadershipMode ? leadershipMembers : teamMembers;
    const renderedKeys = new Set();
    const dayDate = getCurrentLeadershipDate();
    const dayName = getDayNameFromDate(dayDate);
    const dayDateKey = formatDateKey(dayDate, dayName);

    // From leadershipSchedule keys for this day only (key format: dayDateKey-leadership-start-end)
    Object.keys(leadershipSchedule).forEach((key) => {
        if (!key.startsWith(dayDateKey + '-leadership-')) return;
        const suffix = key.slice((dayDateKey + '-leadership-').length);
        const parts = suffix.split('-').map(Number);
        if (parts.length < 2) return;
        const startMinutes = parts[0];
        const endMinutes = parts[1];
        const assignments = leadershipSchedule[key] || [];
        assignments.forEach((assignment, assignmentIdx) => {
            const memberIndex = membersToSearch.findIndex(m => m.name === assignment.member);
            if (memberIndex === -1) return;
            const memberColumn = document.querySelector(`.leadership-member-column[data-member-index="${memberIndex}"]`);
            if (!memberColumn) return;
            renderOneLeadershipEntry(memberColumn, key, assignment, assignmentIdx, startMinutes, endMinutes);
            renderedKeys.add(key);
        });
    });
}

// Show client selection modal for leadership mode (minute-based)
function showLeadershipClientModal(memberIndex, startMinutes, endMinutes) {
    if (!isAdminMode && !isLeadershipMode) return;
    
    const modal = document.getElementById('leadershipClientModal');
    const clientList = document.getElementById('leadershipClientSelectionList');
    
    clientList.innerHTML = '';
    
    if (clients.length === 0) {
        clientList.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No clients available. Add clients in Settings.</p>';
    } else {
        clients.forEach(client => {
            const option = document.createElement('div');
            option.className = 'client-option client-option-with-project';
            option.style.borderColor = client.color;
            const clientProjects = projects.filter(p => p.clientName === client.name);
            const projectOptions = '<option value="">— No project —</option>' +
                clientProjects.map(p => `<option value="${(p.name || '').replace(/"/g, '&quot;')}">${(p.name || '').replace(/</g, '&lt;')}${p.budget != null ? ' ($' + p.budget + ')' : ''}</option>`).join('');
            option.innerHTML = `
                <div class="client-option-color" style="background-color: ${client.color}"></div>
                <span class="client-option-name">${client.name}</span>
                <select class="client-project-select" onclick="event.stopPropagation()">
                    ${projectOptions}
                </select>
            `;
            option.onclick = (e) => {
                if (e.target.classList.contains('client-project-select')) return;
                const select = option.querySelector('.client-project-select');
                const projectName = (select && select.value) ? select.value : null;
                createLeadershipTimeEntry(memberIndex, startMinutes, endMinutes, client.name, projectName);
                closeLeadershipClientModal();
            };
            clientList.appendChild(option);
        });
    }
    
    modal.classList.add('show');
    window.leadershipPendingEntry = { memberIndex, startMinutes, endMinutes };
}

// Show edit modal for existing entry
function showLeadershipEditModal(entry) {
    if (!isAdminMode && !isLeadershipMode) return;
    
    const blockKey = entry.dataset.blockKey;
    const assignmentIndex = parseInt(entry.dataset.assignmentIndex);
    const assignments = leadershipSchedule[blockKey] || [];
    const assignment = assignments[assignmentIndex];
    
    if (!assignment) return;
    
    // For now, just allow changing client - time can be changed via resize
    const modal = document.getElementById('leadershipClientModal');
    const clientList = document.getElementById('leadershipClientSelectionList');
    
    clientList.innerHTML = '';
    
    if (clients.length === 0) {
        clientList.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No clients available. Add clients in Settings.</p>';
    } else {
        clients.forEach(client => {
            const option = document.createElement('div');
            option.className = 'client-option client-option-with-project';
            option.style.borderColor = client.color;
            if (client.name === assignment.client) {
                option.style.opacity = '0.5';
            }
            const clientProjects = projects.filter(p => p.clientName === client.name);
            const currentProject = assignment.project || '';
            const projectOptions = '<option value="">— No project —</option>' +
                clientProjects.map(p => `<option value="${(p.name || '').replace(/"/g, '&quot;')}" ${(client.name === assignment.client && currentProject === (p.name || '')) ? 'selected' : ''}>${(p.name || '').replace(/</g, '&lt;')}${p.budget != null ? ' ($' + p.budget + ')' : ''}</option>`).join('');
            option.innerHTML = `
                <div class="client-option-color" style="background-color: ${client.color}"></div>
                <span class="client-option-name">${client.name}${client.name === assignment.client ? ' (current)' : ''}</span>
                <select class="client-project-select" onclick="event.stopPropagation()">
                    ${projectOptions}
                </select>
            `;
            option.onclick = (e) => {
                if (e.target.classList.contains('client-project-select')) return;
                const select = option.querySelector('.client-project-select');
                const projectName = (select && select.value) ? select.value : null;
                closeLeadershipClientModal();
                assignment.client = client.name;
                if (projectName) assignment.project = projectName; else delete assignment.project;
                saveData();
                renderSidebar();
                if (isLeadershipMode) {
                    updateStats();
                    renderAllLeadershipTimeEntries();
                }
                renderCalendar();
                updateStats();
            };
            clientList.appendChild(option);
        });
    }
    
    modal.classList.add('show');
}

// Save leadership entry after resize (move to new time slot key if start/end changed)
function saveLeadershipTimeEntry(oldBlockKey, assignmentIndex, startMinutes, endMinutes) {
    const assignments = leadershipSchedule[oldBlockKey];
    if (!assignments || !assignments[assignmentIndex]) return;
    const assignment = assignments[assignmentIndex];
    const dayDateKey = oldBlockKey.split('-leadership-')[0];
    if (!dayDateKey) return;
    const newBlockId = `leadership-${startMinutes}-${endMinutes}`;
    const newBlockKey = `${dayDateKey}-${newBlockId}`;
    if (newBlockKey === oldBlockKey) {
        saveData();
        if (isLeadershipMode) renderAllLeadershipTimeEntries();
        return;
    }
    saveStateToHistory();
    assignments.splice(assignmentIndex, 1);
    if (assignments.length === 0) delete leadershipSchedule[oldBlockKey];
    if (!leadershipSchedule[newBlockKey]) leadershipSchedule[newBlockKey] = [];
    leadershipSchedule[newBlockKey].push({ member: assignment.member, client: assignment.client });
    saveData();
    if (isLeadershipMode) {
        updateStats();
        renderAllLeadershipTimeEntries();
    }
}

// Close leadership client modal (e.g. user clicks overlay without selecting a client)
function closeLeadershipClientModal() {
    const modal = document.getElementById('leadershipClientModal');
    modal.classList.remove('show');
    window.leadershipPendingEntry = null;
    document.querySelectorAll('.leadership-drag-preview').forEach(el => el.remove());
}

// Create time entry in leadership mode (minute-based). Uses the given start/end range.
function createLeadershipTimeEntry(memberIndex, startMinutes, endMinutes, clientName, projectName = null) {
    if (!isAdminMode && !isLeadershipMode) return;
    if (endMinutes > 1200) endMinutes = 1200;
    if (endMinutes <= startMinutes) endMinutes = startMinutes + 60;

    const membersToUse = isLeadershipMode ? leadershipMembers : teamMembers;
    const member = membersToUse[memberIndex];
    if (!member) return;
    
    const blockId = `leadership-${startMinutes}-${endMinutes}`;
    const dayDate = getCurrentLeadershipDate();
    const dayName = getDayNameFromDate(dayDate);
    const dayDateKey = formatDateKey(dayDate, dayName);
    const blockKey = `${dayDateKey}-${blockId}`;
    
    if (!leadershipSchedule[blockKey]) {
        leadershipSchedule[blockKey] = [];
    }
    const exists = leadershipSchedule[blockKey].some(a =>
        a.member === member.name && a.client === clientName
    );
    if (!exists) {
        saveStateToHistory();
        const assignment = { member: member.name, client: clientName };
        if (projectName) assignment.project = projectName;
        leadershipSchedule[blockKey].push(assignment);
        saveData();
        renderSidebar();
        if (isLeadershipMode) {
            updateStats();
            renderAllLeadershipTimeEntries();
        }
        renderCalendar();
        updateStats();
    }
}

// Delete leadership time entry (global function for onclick). Removes only this block.
window.deleteLeadershipTimeEntry = function(event, blockKey, assignmentIndex) {
    if (!isAdminMode && !isLeadershipMode) return;
    event.stopPropagation();
    if (!leadershipSchedule[blockKey] || !Array.isArray(leadershipSchedule[blockKey])) return;
    saveStateToHistory();
    leadershipSchedule[blockKey].splice(assignmentIndex, 1);
    if (leadershipSchedule[blockKey].length === 0) delete leadershipSchedule[blockKey];
    saveData();
    renderSidebar();
    if (isLeadershipMode) updateStats();
    renderCalendar();
    updateStats();
};

// Move a leadership entry to another column/time (drag-and-drop). Preserves block duration when provided.
function moveLeadershipEntry(fromBlockKey, assignmentIndex, toMemberIndex, startMinutes, endMinutes) {
    const assignments = leadershipSchedule[fromBlockKey];
    if (!assignments || !assignments[assignmentIndex]) return;
    const assignment = assignments[assignmentIndex];
    const membersToUse = isLeadershipMode ? leadershipMembers : teamMembers;
    const toMember = membersToUse[toMemberIndex];
    if (!toMember) return;
    const dayDateKey = fromBlockKey.split('-leadership-')[0];
    if (!dayDateKey) return;
    const newBlockId = `leadership-${startMinutes}-${endMinutes}`;
    const newBlockKey = `${dayDateKey}-${newBlockId}`;
    saveStateToHistory();
    assignments.splice(assignmentIndex, 1);
    if (assignments.length === 0) delete leadershipSchedule[fromBlockKey];
    if (!leadershipSchedule[newBlockKey]) leadershipSchedule[newBlockKey] = [];
    const newAssignment = { member: toMember.name, client: assignment.client };
    if (assignment.project) newAssignment.project = assignment.project;
    leadershipSchedule[newBlockKey].push(newAssignment);
    saveData();
    renderSidebar();
    if (isLeadershipMode) {
        updateStats();
        renderAllLeadershipTimeEntries();
    }
    renderCalendar();
    updateStats();
}

// Duplicate a leadership entry to another column/time (shift-drag). Keeps original in place.
function duplicateLeadershipEntry(fromBlockKey, assignmentIndex, toMemberIndex, startMinutes, endMinutes) {
    const assignments = leadershipSchedule[fromBlockKey];
    if (!assignments || !assignments[assignmentIndex]) return;
    const assignment = assignments[assignmentIndex];
    const membersToUse = isLeadershipMode ? leadershipMembers : teamMembers;
    const toMember = membersToUse[toMemberIndex];
    if (!toMember) return;
    const dayDateKey = fromBlockKey.split('-leadership-')[0];
    if (!dayDateKey) return;
    const newBlockId = `leadership-${startMinutes}-${endMinutes}`;
    const newBlockKey = `${dayDateKey}-${newBlockId}`;
    saveStateToHistory();
    if (!leadershipSchedule[newBlockKey]) leadershipSchedule[newBlockKey] = [];
    const newAssignment = { member: toMember.name, client: assignment.client };
    if (assignment.project) newAssignment.project = assignment.project;
    leadershipSchedule[newBlockKey].push(newAssignment);
    saveData();
    renderSidebar();
    if (isLeadershipMode) {
        updateStats();
        renderAllLeadershipTimeEntries();
    }
    renderCalendar();
    updateStats();
}

