// Data storage
let teamMembers = []; // Format: [{ name: "John", color: "#ce2828", profilePicture: "data:image/..." }, ...]
let leadershipMembers = []; // Format: [{ name: "John", color: "#ce2828", profilePicture: "data:image/..." }, ...]
let clients = []; // Format: [{ name: "Client A", color: "#667eea" }, ...]
let schedule = {}; // Format: { "2024-01-15-Monday-Work1": [{ member: "John", client: "Client A" }, ...] }
let currentWeekStart = new Date();
let isDarkTheme = true; // Default to dark theme
let timeBlocks = []; // Format: [{ id: 'Work1', label: 'Work Block 1', time: '11:00 AM - 1:00 PM', startTime: '11:00', endTime: '13:00', isLunch: false }, ...]
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
    const tabs = document.querySelectorAll('.auth-tab');
    const signInForm = document.getElementById('authSignInForm');
    const signUpForm = document.getElementById('authSignUpForm');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const isSignUp = tab.dataset.tab === 'signup';
            signInForm.style.display = isSignUp ? 'none' : 'block';
            signUpForm.style.display = isSignUp ? 'block' : 'none';
        });
    });
    signInForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmailSignIn').value.trim();
        const password = document.getElementById('authPasswordSignIn').value;
        const stored = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
        const user = stored[email];
        if (!user || user.password !== password) {
            alert('Invalid email or password.');
            return;
        }
        currentUser = { email: user.email, firstName: user.firstName, lastName: user.lastName, profilePictureUrl: user.profilePictureUrl, avatarBorderColor: user.avatarBorderColor || '#318cc3' };
        localStorage.setItem('teamScheduleUser', JSON.stringify(currentUser));
        location.reload();
    });
    signUpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const firstName = document.getElementById('authFirstName').value.trim();
        const lastName = document.getElementById('authLastName').value.trim();
        const email = document.getElementById('authEmailSignUp').value.trim();
        const password = document.getElementById('authPasswordSignUp').value;
        const stored = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
        if (stored[email]) {
            alert('An account with this email already exists. Sign in instead.');
            return;
        }
        stored[email] = { email, firstName, lastName, password, profilePictureUrl: '', avatarBorderColor: '#318cc3' };
        localStorage.setItem('teamScheduleUsers', JSON.stringify(stored));
        currentUser = { email, firstName, lastName, profilePictureUrl: '', avatarBorderColor: '#318cc3' };
        localStorage.setItem('teamScheduleUser', JSON.stringify(currentUser));
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
    console.log('🚀 Initializing app...');
    const authScreen = document.getElementById('authScreen');
    const appContainer = document.getElementById('appContainer');
    const hasAuthGate = authScreen && appContainer;
    if (hasAuthGate) {
        let storedUser = JSON.parse(localStorage.getItem('teamScheduleUser') || 'null');
        if (storedUser && storedUser.email) {
            const users = JSON.parse(localStorage.getItem('teamScheduleUsers') || '{}');
            const latest = users[storedUser.email];
            if (latest) {
                storedUser = { ...storedUser, profilePictureUrl: latest.profilePictureUrl || storedUser.profilePictureUrl, avatarBorderColor: latest.avatarBorderColor || storedUser.avatarBorderColor, firstName: latest.firstName ?? storedUser.firstName, lastName: latest.lastName ?? storedUser.lastName };
            }
        }
        currentUser = storedUser;
        if (!currentUser) {
            showAuthScreen();
            setupAuthListeners();
            return;
        }
        const profileFromSupabase = await loadProfileFromSupabase(currentUser.email);
        if (profileFromSupabase) {
            currentUser.firstName = profileFromSupabase.first_name ?? currentUser.firstName;
            currentUser.lastName = profileFromSupabase.last_name ?? currentUser.lastName;
            currentUser.profilePictureUrl = profileFromSupabase.profile_picture_url ?? currentUser.profilePictureUrl;
            currentUser.avatarBorderColor = profileFromSupabase.avatar_border_color ?? currentUser.avatarBorderColor;
        }
        authScreen.style.display = 'none';
        appContainer.style.display = 'flex';
    }
    await loadData();
    initializeCalendar();
    setupEventListeners();
    renderSidebar();
    renderSettings();
    updateStats();
    // Delay realtime subscriptions to avoid first-load flicker (race with initial render)
    setTimeout(() => setupRealtimeSubscriptions(), 1500);
    renderTimeTracking();
    updateDayHeaders();
    renderOnlineUsersStrip();
    if (currentUser) {
        updateMyOnlinePresence();
        fetchOnlineUsers();
        setInterval(updateMyOnlinePresence, 30000);
        setInterval(fetchOnlineUsers, 30000);
    }
    console.log('✅ App initialized');

    // Update day headers every minute to catch day changes
    setInterval(() => {
        updateDayHeaders();
        renderCalendar(); // Re-render to update day columns too
    }, 60000); // Check every minute
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
            // Skip if we're currently saving to prevent loops
            if (isSaving) {
                console.log('⏭️ Skipping real-time update (save in progress)');
                return;
            }
            console.log('📢 Real-time update: team_members changed', payload.eventType);
            await loadTeamMembers(true); // Skip defaults on real-time updates
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

// Load team members from Supabase
async function loadTeamMembers(skipDefaults = false) {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.warn('Supabase not available, using localStorage');
        const savedMembers = localStorage.getItem('teamMembers');
        if (savedMembers) {
            teamMembers = JSON.parse(savedMembers);
        } else {
            teamMembers = [
                { name: 'John Doe', color: '#ce2828', profilePicture: '' },
                { name: 'Jane Smith', color: '#4a90e2', profilePicture: '' },
                { name: 'Bob Johnson', color: '#50c878', profilePicture: '' }
            ];
        }
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .order('name');

        if (error) {
            console.error('Supabase error loading team members:', error);
            throw error;
        }

        if (data && data.length > 0) {
            teamMembers = data.map(m => ({
                name: m.name,
                color: m.color,
                profilePicture: m.profile_picture || ''
            }));
        } else if (!skipDefaults) {
            // Only create defaults on initial load, not on real-time updates
            // Default data if empty
            console.log('No team members found, creating defaults...');
            teamMembers = [
                { name: 'John Doe', color: '#ce2828', profilePicture: '' },
                { name: 'Jane Smith', color: '#4a90e2', profilePicture: '' },
                { name: 'Bob Johnson', color: '#50c878', profilePicture: '' }
            ];
            // Save defaults to database (don't await - let it happen in background)
            if (!isSaving) {
                isSaving = true;
                saveTeamMembers().catch(err => console.error('Failed to save default team members:', err)).finally(() => {
                    isSaving = false;
                });
            }
        }
    } catch (error) {
        console.error('Error loading team members:', error);
        // Fallback to localStorage
        const savedMembers = localStorage.getItem('teamMembers');
        if (savedMembers) {
            teamMembers = JSON.parse(savedMembers);
        } else {
            // If no localStorage data, use defaults
            teamMembers = [
                { name: 'John Doe', color: '#ce2828', profilePicture: '' },
                { name: 'Jane Smith', color: '#4a90e2', profilePicture: '' },
                { name: 'Bob Johnson', color: '#50c878', profilePicture: '' }
            ];
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
        } else if (!skipDefaults) {
            // Only create defaults on initial load, not on real-time updates
            // Default data if empty
            console.log('No clients found, creating defaults...');
            clients = [
                { name: 'Client A', color: '#667eea' },
                { name: 'Client B', color: '#764ba2' },
                { name: 'Client C', color: '#f093fb' }
            ];
            // Save defaults to database (don't await - let it happen in background)
            if (!isSaving) {
                isSaving = true;
                saveClients().catch(err => console.error('Failed to save default clients:', err)).finally(() => {
                    isSaving = false;
                });
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

// Load schedule from Supabase
async function loadSchedule() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.warn('Supabase not available, using localStorage');
        const savedSchedule = localStorage.getItem('schedule');
        if (savedSchedule) {
            schedule = JSON.parse(savedSchedule);
            // Migrate old single assignment format to array format
            Object.keys(schedule).forEach(key => {
                if (schedule[key] && !Array.isArray(schedule[key])) {
                    schedule[key] = [schedule[key]];
                }
            });
        }
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('schedule')
            .select('*');

        if (error) throw error;

        schedule = {};
        if (data && data.length > 0) {
            data.forEach(row => {
                schedule[row.block_key] = row.assignments;
            });
        }
    } catch (error) {
        console.error('Error loading schedule:', error);
        // Fallback to localStorage
        const savedSchedule = localStorage.getItem('schedule');
        if (savedSchedule) {
            schedule = JSON.parse(savedSchedule);
            // Migrate old single assignment format to array format
            Object.keys(schedule).forEach(key => {
                if (schedule[key] && !Array.isArray(schedule[key])) {
                    schedule[key] = [schedule[key]];
                }
            });
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
            timeBlocks = JSON.parse(savedTimeBlocks);
        } else {
            timeBlocks = [
                { id: 'Work1', label: 'Work Block 1', time: '11:00 AM - 1:00 PM', startTime: '11:00', endTime: '13:00', isLunch: false },
                { id: 'Lunch', label: 'Lunch', time: '1:00 PM - 2:00 PM', startTime: '13:00', endTime: '14:00', isLunch: true },
                { id: 'Work2', label: 'Work Block 2', time: '2:00 PM - 4:00 PM', startTime: '14:00', endTime: '16:00', isLunch: false },
                { id: 'Work3', label: 'Work Block 3', time: '4:00 PM - 6:00 PM', startTime: '16:00', endTime: '18:00', isLunch: false }
            ];
        }

        const savedWeek = localStorage.getItem('currentWeekStart');
        if (savedWeek) {
            currentWeekStart = new Date(savedWeek);
        } else {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            currentWeekStart = new Date(today.setDate(diff));
            currentWeekStart.setHours(0, 0, 0, 0);
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
                    timeBlocks = setting.value;
                } else if (setting.key === 'isDarkTheme') {
                    isDarkTheme = setting.value;
                } else if (setting.key === 'clientDetails') {
                    clientDetails = setting.value || {};
                }
                // Note: currentWeekStart is NOT loaded from Supabase - it stays local per device
            });
        }

        // Load currentWeekStart from localStorage only (never from Supabase)
        const savedWeek = localStorage.getItem('currentWeekStart');
        if (savedWeek) {
            currentWeekStart = new Date(savedWeek);
        } else {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            currentWeekStart = new Date(today.setDate(diff));
            currentWeekStart.setHours(0, 0, 0, 0);
            // Save to localStorage only
            localStorage.setItem('currentWeekStart', currentWeekStart.toISOString());
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
        // Fallback to localStorage
        const savedTimeBlocks = localStorage.getItem('timeBlocks');
        if (savedTimeBlocks) {
            timeBlocks = JSON.parse(savedTimeBlocks);
        } else {
            timeBlocks = [
                { id: 'Work1', label: 'Work Block 1', time: '11:00 AM - 1:00 PM', startTime: '11:00', endTime: '13:00', isLunch: false },
                { id: 'Lunch', label: 'Lunch', time: '1:00 PM - 2:00 PM', startTime: '13:00', endTime: '14:00', isLunch: true },
                { id: 'Work2', label: 'Work Block 2', time: '2:00 PM - 4:00 PM', startTime: '14:00', endTime: '16:00', isLunch: false },
                { id: 'Work3', label: 'Work Block 3', time: '4:00 PM - 6:00 PM', startTime: '16:00', endTime: '18:00', isLunch: false }
            ];
        }

        const savedWeek = localStorage.getItem('currentWeekStart');
        if (savedWeek) {
            currentWeekStart = new Date(savedWeek);
        } else {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            currentWeekStart = new Date(today.setDate(diff));
            currentWeekStart.setHours(0, 0, 0, 0);
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
    console.log('Loaded team members:', teamMembers.length);
    
    await loadLeadershipMembers();
    console.log('Loaded leadership members:', leadershipMembers.length);
    
    await loadClients();
    console.log('Loaded clients:', clients.length);
    
    await loadSchedule();
    console.log('Loaded schedule entries:', Object.keys(schedule).length);
    
    await loadAppSettings();
    console.log('Loaded time blocks:', timeBlocks.length);
    
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
        timeBlocks: JSON.parse(JSON.stringify(timeBlocks))
    };
    
    undoHistory.push(state);
    
    // Limit history size
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
        if (previousState.timeBlocks) {
            timeBlocks = previousState.timeBlocks;
        }
        
        saveData();
        renderSidebar();
        renderSettings();
        renderCalendar();
        updateStats();
    }
}

// Save team members to Supabase
async function saveTeamMembers() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        localStorage.setItem('teamMembers', JSON.stringify(teamMembers));
        return;
    }
    
    try {
        // Get all existing members first
        const { data: existing, error: selectError } = await supabase.from('team_members').select('id');
        if (selectError) {
            console.error('Error selecting existing team members:', selectError);
            throw selectError;
        }
        
        // Delete all existing members if any
        if (existing && existing.length > 0) {
            const idsToDelete = existing.map(m => m.id);
            const { error: deleteError } = await supabase
                .from('team_members')
                .delete()
                .in('id', idsToDelete);
            if (deleteError) {
                console.error('Error deleting team members:', deleteError);
                throw deleteError;
            }
            console.log('Deleted', existing.length, 'existing team members');
        }
        
        // Insert all current members
        if (teamMembers.length > 0) {
            const membersToInsert = teamMembers.map(m => ({
                name: m.name,
                color: m.color,
                profile_picture: m.profilePicture || ''
            }));
            
            const { error } = await supabase
                .from('team_members')
                .insert(membersToInsert);
            
            if (error) {
                console.error('Error inserting team members:', error);
                throw error;
            }
            console.log('✅ Saved', teamMembers.length, 'team members to Supabase');
        }
    } catch (error) {
        console.error('Error saving team members:', error);
        // Fallback to localStorage
        localStorage.setItem('teamMembers', JSON.stringify(teamMembers));
    }
}

// Load leadership members from Supabase
async function loadLeadershipMembers(skipDefaults = false) {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.warn('Supabase not available, using localStorage');
        const savedMembers = localStorage.getItem('leadershipMembers');
        if (savedMembers) {
            leadershipMembers = JSON.parse(savedMembers);
        } else {
            leadershipMembers = [];
        }
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('leadership_members')
            .select('*')
            .order('name');

        if (error) {
            console.error('Supabase error loading leadership members:', error);
            throw error;
        }

        if (data && data.length > 0) {
            leadershipMembers = data.map(m => ({
                name: m.name,
                color: m.color,
                profilePicture: m.profile_picture || ''
            }));
        } else {
            leadershipMembers = [];
        }
    } catch (error) {
        console.error('Error loading leadership members:', error);
        // Fallback to localStorage
        const savedMembers = localStorage.getItem('leadershipMembers');
        if (savedMembers) {
            leadershipMembers = JSON.parse(savedMembers);
        } else {
            leadershipMembers = [];
        }
    }
}

// Save leadership members to Supabase
async function saveLeadershipMembers() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        localStorage.setItem('leadershipMembers', JSON.stringify(leadershipMembers));
        return;
    }
    
    try {
        // Get all existing members first
        const { data: existing, error: selectError } = await supabase.from('leadership_members').select('id');
        if (selectError) {
            console.error('Error selecting existing leadership members:', selectError);
            throw selectError;
        }
        
        // Delete all existing members if any
        if (existing && existing.length > 0) {
            const idsToDelete = existing.map(m => m.id);
            const { error: deleteError } = await supabase
                .from('leadership_members')
                .delete()
                .in('id', idsToDelete);
            if (deleteError) {
                console.error('Error deleting leadership members:', deleteError);
                throw deleteError;
            }
        }
        
        // Insert all current members
        if (leadershipMembers.length > 0) {
            const membersToInsert = leadershipMembers.map(m => ({
                name: m.name,
                color: m.color,
                profile_picture: m.profilePicture || ''
            }));
            
            const { error } = await supabase
                .from('leadership_members')
                .insert(membersToInsert);
            
            if (error) {
                console.error('Error inserting leadership members:', error);
                throw error;
            }
            console.log('✅ Saved', leadershipMembers.length, 'leadership members to Supabase');
        }
    } catch (error) {
        console.error('Error saving leadership members:', error);
        // Fallback to localStorage
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
    } catch (error) {
        console.error('Error saving clients:', error);
        // Fallback to localStorage
        localStorage.setItem('clients', JSON.stringify(clients));
    }
}

// Save schedule to Supabase
async function saveSchedule() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        localStorage.setItem('schedule', JSON.stringify(schedule));
        return;
    }
    
    try {
        // Get all current schedule entries
        const scheduleEntries = Object.keys(schedule).map(blockKey => ({
            block_key: blockKey,
            assignments: schedule[blockKey]
        }));

        // Get all existing schedule entries first
        const { data: existing } = await supabase.from('schedule').select('id');
        
        // Delete all existing schedule entries if any
        if (existing && existing.length > 0) {
            const idsToDelete = existing.map(s => s.id);
            const { error: deleteError } = await supabase
                .from('schedule')
                .delete()
                .in('id', idsToDelete);
            if (deleteError) throw deleteError;
        }

        // Insert all current schedule entries
        if (scheduleEntries.length > 0) {
            const { error } = await supabase
                .from('schedule')
                .insert(scheduleEntries);
            
            if (error) throw error;
        }
    } catch (error) {
        console.error('Error saving schedule:', error);
        // Fallback to localStorage
        localStorage.setItem('schedule', JSON.stringify(schedule));
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
        // Save timeBlocks, isDarkTheme, clientDetails to Supabase (currentWeekStart stays local)
        const settings = [
            { key: 'timeBlocks', value: timeBlocks },
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
        // Fallback to localStorage
        localStorage.setItem('timeBlocks', JSON.stringify(timeBlocks));
        localStorage.setItem('isDarkTheme', isDarkTheme);
        localStorage.setItem('clientDetails', JSON.stringify(clientDetails));
    }
    
    // Always save currentWeekStart to localStorage only (never to Supabase)
    localStorage.setItem('currentWeekStart', currentWeekStart.toISOString());
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
        await saveLeadershipMembers();
        await saveClients();
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
    
    timeBlocks.forEach((block, index) => {
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
            const timeBlock = document.createElement('div');
            timeBlock.className = `time-block ${block.id === 'Lunch' ? 'lunch' : 'work-block'}`;
            
            if (block.id === 'Lunch') {
                timeBlock.textContent = 'Lunch';
            } else {
                const blockKey = `${dateKey}-${block.id}`;
                const assignments = schedule[blockKey] || [];

                // Sort assignments alphabetically by member name
                const sortedAssignments = [...assignments].sort((a, b) => {
                    const nameA = (a.member || '').toLowerCase();
                    const nameB = (b.member || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                // Create assignments container
                const assignmentsContainer = document.createElement('div');
                assignmentsContainer.className = 'assignments-container';

                // Track which original indices we've already used to handle duplicates
                const usedIndices = new Set();
                sortedAssignments.forEach((assignment, sortedIndex) => {
                    // Find the original index in the unsorted array, skipping already used ones
                    let originalIndex = -1;
                    for (let i = 0; i < assignments.length; i++) {
                        if (!usedIndices.has(i) && 
                            assignments[i].member === assignment.member && 
                            assignments[i].client === assignment.client) {
                            originalIndex = i;
                            usedIndices.add(i);
                            break;
                        }
                    }
                    // Fallback if not found (shouldn't happen)
                    if (originalIndex === -1) {
                        originalIndex = assignments.findIndex(a => 
                            a.member === assignment.member && a.client === assignment.client
                        );
                    }
                    
                    const member = teamMembers.find(m => m.name === assignment.member);
                    const client = clients.find(c => c.name === assignment.client);
                    const memberColor = member ? member.color : '#ce2828';
                    const clientColor = client ? client.color : '#667eea';
                    const profilePicture = member && member.profilePicture ? member.profilePicture : '';

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
                                        `<img src="${profilePicture}" alt="${assignment.member}" class="assignment-profile-picture">` : 
                                        `<span class="assignment-member-initial" style="color: ${memberTextColor};">${assignment.member.charAt(0).toUpperCase()}</span>`
                                    }
                                </div>
                                <div class="assignment-member-box">
                                    <span class="assignment-member-name" style="color: ${memberTextColor};">${assignment.member}</span>
                                </div>
                            </div>
                            <div class="assignment-client-box" style="background-color: ${clientColor};">
                                <span class="assignment-client-name" style="color: ${clientTextColor};">${assignment.client}</span>
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
                
                // Clear this block button
                if (assignments.length > 0) {
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
    
    if (clients.length === 0) {
        clientList.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No clients available. Add clients in Settings.</p>';
    } else {
        clients.forEach(client => {
            const option = document.createElement('div');
            option.className = 'client-option';
            option.style.borderColor = client.color;
            option.innerHTML = `
                <div class="client-option-color" style="background-color: ${client.color}"></div>
                <span>${client.name}</span>
            `;
            option.onclick = () => {
                if (assignmentIndex !== null && window.editingAssignment) {
                    // Editing existing assignment
                    updateAssignmentClient(blockKey, assignmentIndex, client.name);
                } else {
                    // New assignment
                    assignMemberToBlock(memberName, client.name, blockKey);
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

// Update assignment client
function updateAssignmentClient(blockKey, assignmentIndex, newClientName) {
    if (!isAdminMode) return;
    
    saveStateToHistory();
    if (schedule[blockKey] && Array.isArray(schedule[blockKey]) && schedule[blockKey][assignmentIndex]) {
        schedule[blockKey][assignmentIndex].client = newClientName;
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

// Assign member to block
function assignMemberToBlock(memberName, clientName, blockKey) {
    if (!isAdminMode) return;
    
    if (!schedule[blockKey]) {
        schedule[blockKey] = [];
    }
    
    // Check if member is already in this block and remove existing assignment
    const existingIndex = schedule[blockKey].findIndex(
        assignment => assignment.member === memberName
    );
    
    // If member already exists, remove the old assignment
    if (existingIndex !== -1) {
        schedule[blockKey].splice(existingIndex, 1);
    }
    
    saveStateToHistory();
    schedule[blockKey].push({
        member: memberName,
        client: clientName
    });
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

// Update assignment client
function updateAssignmentClient(blockKey, assignmentIndex, newClientName) {
    if (!isAdminMode) return;
    
    saveStateToHistory();
    if (schedule[blockKey] && Array.isArray(schedule[blockKey]) && schedule[blockKey][assignmentIndex]) {
        schedule[blockKey][assignmentIndex].client = newClientName;
        saveData();
        renderCalendar();
        updateStats();
    }
    window.editingAssignment = null;
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
        item.draggable = isAdminMode;
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
        
        if (isAdminMode) {
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
            <div class="settings-item-actions" style="${disabledStyle}">
                <button class="btn-edit" onclick="editLeadershipMember(${index})" ${disabledAttr}>Edit</button>
                <button class="btn-delete" onclick="deleteLeadershipMember(${index})" ${disabledAttr}>Delete</button>
            </div>
        `;
        leadershipMembersList.appendChild(item);
    });
    }

    if (!clientsList) return;
    clientsList.innerHTML = '';
    clients.forEach((client, index) => {
        const item = document.createElement('div');
        item.className = 'settings-item';
        const disabledAttr = isAdminMode ? '' : 'disabled';
        const disabledStyle = isAdminMode ? '' : 'opacity: 0.5; pointer-events: none;';
        item.innerHTML = `
            <div class="settings-item-color-picker" style="${disabledStyle}">
                <input type="color" id="clientColor${index}" value="${client.color}" 
                       onchange="updateClientColor(${index}, this.value)" class="color-picker" ${disabledAttr}>
                <label for="clientColor${index}" class="color-picker-label"></label>
            </div>
            <span class="settings-item-name">${client.name}</span>
            <div class="settings-item-actions" style="${disabledStyle}">
                <button class="btn-edit btn-edit-icon" onclick="openClientDetail(${index})" ${disabledAttr} title="Edit name, deadline & project stops">&#9998;</button>
                <button class="btn-delete" onclick="deleteClient(${index})" ${disabledAttr}>Delete</button>
            </div>
        `;
        clientsList.appendChild(item);
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
        closeSettings.addEventListener('click', () => document.getElementById('settingsModal').classList.remove('show'));
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
    const closeClientDetail = document.getElementById('closeClientDetail');
    if (closeClientDetail) {
        closeClientDetail.addEventListener('click', () => saveClientDetailAndClose());
    }
    const addClientStopBtn = document.getElementById('addClientStopBtn');
    if (addClientStopBtn) {
        addClientStopBtn.addEventListener('click', () => {
        const list = document.getElementById('clientDetailStopsList');
        const row = document.createElement('div');
        row.className = 'client-stop-row';
        row.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;';
        row.innerHTML = `
            <input type="text" class="input-field client-stop-name" placeholder="e.g. Design" style="flex:1">
            <input type="date" class="input-field client-stop-due" placeholder="Due">
            <button type="button" class="btn-delete client-stop-remove">×</button>
        `;
        row.querySelector('.client-stop-remove').addEventListener('click', () => row.remove());
            list.appendChild(row);
        });
    }
    
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
        const profileModal = document.getElementById('profileModal');
        const clientDetailModal = document.getElementById('clientDetailModal');
        if (e.target === profileModal) {
            profileModal.classList.remove('show');
        }
        if (clientDetailModal && e.target === clientDetailModal) {
            saveClientDetailAndClose();
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
                profilePicture: ''
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
                    profilePicture: ''
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

    // Add client
    document.getElementById('addClientBtn').addEventListener('click', () => {
        if (!isAdminMode) return;
        const input = document.getElementById('newClientName');
        const name = input.value.trim();
        if (name && !clients.find(c => c.name === name)) {
            saveStateToHistory();
            const defaultColors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
            clients.push({
                name: name,
                color: defaultColors[clients.length % defaultColors.length]
            });
            saveData();
            renderSidebar();
            renderSettings();
            input.value = '';
        } else if (clients.find(c => c.name === name)) {
            alert('Client already exists!');
        }
    });

    // Keyboard shortcut for undo (Ctrl+Z)
    document.addEventListener('keydown', (e) => {
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
        localStorage.setItem('currentWeekStart', currentWeekStart.toISOString());
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
        localStorage.setItem('currentWeekStart', currentWeekStart.toISOString());
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
            localStorage.setItem('currentWeekStart', currentWeekStart.toISOString());
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

    document.getElementById('newClientName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addClientBtn').click();
        }
    });
    
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

// Edit member
function editMember(index) {
    const newName = prompt('Enter new name:', teamMembers[index].name);
    if (newName && newName.trim() && !teamMembers.find(m => m.name === newName.trim())) {
        saveStateToHistory();
        const oldName = teamMembers[index].name;
        teamMembers[index].name = newName.trim();
        
        // Update all schedule entries with this member
        Object.keys(schedule).forEach(key => {
            if (Array.isArray(schedule[key])) {
                schedule[key].forEach(assignment => {
                    if (assignment.member === oldName) {
                        assignment.member = newName.trim();
                    }
                });
            }
        });
        
        // Sync to leadership members if they're toggled
        syncProductionMemberToLeadership(oldName, teamMembers[index]);
        
        saveData();
        renderSidebar();
        renderSettings();
        renderCalendar();
        updateStats();
        if (isLeadershipMode) {
            renderSidebar(); if (isLeadershipMode) updateStats();
        }
    } else if (teamMembers.find(m => m.name === newName.trim())) {
        alert('Member with this name already exists!');
    }
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
        
        // Update all schedule entries with this client
        Object.keys(schedule).forEach(key => {
            if (Array.isArray(schedule[key])) {
                schedule[key].forEach(assignment => {
                    if (assignment.client === oldName) {
                        assignment.client = newName.trim();
                    }
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
    
    // Remove all schedule entries with this client
    Object.keys(schedule).forEach(key => {
        if (Array.isArray(schedule[key])) {
            schedule[key] = schedule[key].filter(assignment => assignment.client !== clientName);
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

// Client detail modal (deadline, project stops)
let clientDetailEditingIndex = -1;

function openClientDetail(clientIndex) {
    if (!isAdminMode) return;
    clientDetailEditingIndex = clientIndex;
    const client = clients[clientIndex];
    if (!client) return;
    const details = clientDetails[client.name] || { deadline: '', stops: [] };
    if (!details.stops || !Array.isArray(details.stops)) details.stops = [];
    document.getElementById('clientDetailTitle').textContent = 'Edit client';
    const nameEl = document.getElementById('clientDetailName');
    if (nameEl) nameEl.value = client.name;
    document.getElementById('clientDetailDeadline').value = details.deadline || '';
    renderClientDetailStops(details.stops);
    document.getElementById('clientDetailModal').classList.add('show');
}

function renderClientDetailStops(stops) {
    const list = document.getElementById('clientDetailStopsList');
    list.innerHTML = '';
    (stops || []).forEach((stop, i) => {
        const row = document.createElement('div');
        row.className = 'client-stop-row';
        row.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;';
        row.innerHTML = `
            <input type="text" class="input-field client-stop-name" value="${(stop.name || '').replace(/"/g, '&quot;')}" placeholder="e.g. Design" style="flex:1">
            <input type="date" class="input-field client-stop-due" value="${stop.due || ''}" placeholder="Due">
            <button type="button" class="btn-delete client-stop-remove" data-index="${i}">×</button>
        `;
        row.querySelector('.client-stop-remove').addEventListener('click', () => row.remove());
        list.appendChild(row);
    });
}

function saveClientDetailAndClose() {
    if (clientDetailEditingIndex < 0) return;
    const client = clients[clientDetailEditingIndex];
    if (!client) return;
    const nameEl = document.getElementById('clientDetailName');
    const newName = nameEl && nameEl.value.trim() ? nameEl.value.trim() : client.name;
    const deadline = document.getElementById('clientDetailDeadline').value || '';
    const stopRows = document.querySelectorAll('.client-stop-row');
    const stops = [];
    stopRows.forEach(row => {
        const nEl = row.querySelector('.client-stop-name');
        const dueEl = row.querySelector('.client-stop-due');
        if (nEl && nEl.value.trim()) {
            stops.push({ name: nEl.value.trim(), due: dueEl ? dueEl.value : '' });
        }
    });
    const oldName = client.name;
    if (newName !== oldName && !clients.find(c => c.name === newName && c !== client)) {
        saveStateToHistory();
        client.name = newName;
        if (clientDetails[oldName]) {
            clientDetails[newName] = clientDetails[oldName];
            delete clientDetails[oldName];
        }
        saveData();
        renderSidebar();
    }
    clientDetails[newName] = { deadline, stops };
    saveAppSettings();
    if (newName !== oldName) renderSettings();
    document.getElementById('clientDetailModal').classList.remove('show');
    clientDetailEditingIndex = -1;
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
    if (!isAdminMode) return;
    const newName = prompt('Enter new name:', leadershipMembers[index].name);
    if (newName && newName.trim() && !leadershipMembers.find(m => m.name === newName.trim())) {
        saveStateToHistory();
        const oldName = leadershipMembers[index].name;
        leadershipMembers[index].name = newName.trim();
        
        // Update all schedule entries with this member
        Object.keys(schedule).forEach(key => {
            if (Array.isArray(schedule[key])) {
                schedule[key].forEach(assignment => {
                    if (assignment.member === oldName) {
                        assignment.member = newName.trim();
                    }
                });
            }
        });
        
        saveData();
        renderSettings();
        if (isLeadershipMode) {
            renderSidebar(); if (isLeadershipMode) updateStats();
        }
        updateStats();
    } else if (leadershipMembers.find(m => m.name === newName.trim())) {
        alert('Leadership member with this name already exists!');
    }
};

window.deleteLeadershipMember = function(index) {
    if (!isAdminMode) return;
    saveStateToHistory();
    const memberName = leadershipMembers[index].name;
    leadershipMembers.splice(index, 1);
    
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
    renderSettings();
    if (isLeadershipMode) {
        renderSidebar(); if (isLeadershipMode) updateStats();
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
                profilePicture: member.profilePicture
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

// Calculate and update statistics
function updateStats() {
    const personHours = {};
    const clientHours = {};
    
    // Calculate hours per block dynamically from timeBlocks
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Initialize counters
    teamMembers.forEach(member => {
        personHours[member.name] = 0;
    });
    
    clients.forEach(client => {
        clientHours[client.name] = 0;
    });
    
    // Count hours from schedule - ONLY for the current week
    days.forEach((day, dayIndex) => {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIndex);
        const dateKey = formatDateKey(dayDate, day);
        
        timeBlocks.forEach(block => {
            if (block.isLunch) return;
            
            const blockKey = `${dateKey}-${block.id}`;
            const assignments = schedule[blockKey] || [];
            
            // Calculate hours for this block
            const startHour = parseInt(block.startTime.split(':')[0]);
            const endHour = parseInt(block.endTime.split(':')[0]);
            const blockHours = endHour - startHour;
            
            if (Array.isArray(assignments)) {
                assignments.forEach(assignment => {
                    if (!assignment || !assignment.member || !assignment.client) return;
                    
                    if (personHours.hasOwnProperty(assignment.member)) {
                        personHours[assignment.member] += blockHours;
                    }
                    if (clientHours.hasOwnProperty(assignment.client)) {
                        clientHours[assignment.client] += blockHours;
                    }
                });
            }
        });
    });
    
    // Render person stats
    const personStatsDiv = document.getElementById('personStats');
    personStatsDiv.innerHTML = '';
    
    const sortedPersons = Object.entries(personHours)
        .sort((a, b) => b[1] - a[1]);
    
    sortedPersons.forEach(([name, hours]) => {
        const statItem = document.createElement('div');
        statItem.className = 'stat-item';
        const member = teamMembers.find(m => m.name === name);
        const color = member ? member.color : '#ce2828';
        statItem.innerHTML = `
            <div class="stat-color" style="background-color: ${color}"></div>
            <span class="stat-name">${name}</span>
            <span class="stat-value">${hours}h</span>
        `;
        personStatsDiv.appendChild(statItem);
    });
    
    // Render client stats
    const clientStatsDiv = document.getElementById('clientStats');
    clientStatsDiv.innerHTML = '';
    
    const sortedClients = Object.entries(clientHours)
        .sort((a, b) => b[1] - a[1]);
    
    sortedClients.forEach(([name, hours]) => {
        const statItem = document.createElement('div');
        statItem.className = 'stat-item';
        const client = clients.find(c => c.name === name);
        const color = client ? client.color : '#667eea';
        statItem.innerHTML = `
            <div class="stat-color" style="background-color: ${color}"></div>
            <span class="stat-name">${name}</span>
            <span class="stat-value">${hours}h</span>
        `;
        clientStatsDiv.appendChild(statItem);
    });
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
    
    const membersHeader = document.getElementById('leadershipMembersHeader');
    const timeColumn = document.getElementById('leadershipTimeColumn');
    const grid = document.getElementById('leadershipGrid');
    
    // Clear existing content
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
        
        // Add global mouse handlers for this column (minute-based)
        memberColumn.addEventListener('mousedown', (e) => {
            if (!isAdminMode) return;
            // Check if clicking on resize handle
            if (e.target.classList.contains('leadership-time-entry-resize-handle')) {
                const entry = e.target.closest('.leadership-time-entry');
                if (entry && entry.dataset.blockKey) {
                    leadershipResizeState = {
                        entry: entry,
                        isTop: e.target.classList.contains('top'),
                        startY: e.clientY,
                        startMinutes: parseInt(entry.dataset.startMinutes),
                        endMinutes: parseInt(entry.dataset.endMinutes),
                        memberIndex: memberIndex
                    };
                    return;
                }
            }
            // Don't interfere with existing entries (unless clicking delete button)
            if (e.target.closest('.leadership-time-entry') && !e.target.classList.contains('leadership-time-entry-delete')) {
                // Click on entry to edit - show edit modal
                const entry = e.target.closest('.leadership-time-entry');
                if (entry && entry.dataset.blockKey) {
                    showLeadershipEditModal(entry);
                }
                return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            const columnRect = memberColumn.getBoundingClientRect();
            const relativeY = e.clientY - columnRect.top;
            // Convert pixels to minutes (60px per hour, so 1px = 1 minute)
            const startMinutes = Math.max(480, Math.min(1200, Math.round(relativeY))); // 8:00 AM = 480 min, 8:00 PM = 1200 min
            
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
            
            // Visual feedback
            memberColumn.style.cursor = 'ns-resize';
        });
        
        // Add global mouse handlers for drag (on document to catch mouseup outside column)
        const handleMouseMove = (e) => {
            // Handle resize
            if (leadershipResizeState && leadershipResizeState.memberIndex === memberIndex) {
                const columnRect = memberColumn.getBoundingClientRect();
                const relativeY = e.clientY - columnRect.top;
                const newMinutes = Math.max(480, Math.min(1200, Math.round(relativeY)));
                
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
                const newMinutes = Math.max(480, Math.min(1200, Math.round(relativeY)));
                
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
            
            // Handle drag end
            if (leadershipDragState && leadershipDragState.memberIndex === memberIndex) {
                const start = Math.min(leadershipDragState.startMinutes, leadershipDragState.currentMinutes);
                const end = Math.max(leadershipDragState.startMinutes, leadershipDragState.currentMinutes);
                const duration = end - start;
                
                // Always show modal if there's a duration, or if it was a quick click
                if (duration > 0 || !leadershipDragState.isDragging) {
                    const finalStart = leadershipDragState.isDragging ? start : leadershipDragState.startMinutes;
                    const finalEnd = leadershipDragState.isDragging ? end : (leadershipDragState.startMinutes + 30);
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
        
        // Add document-level listeners when mousedown happens
        memberColumn.addEventListener('mousedown', (e) => {
            // Only add if it's not a resize or entry click
            if (!e.target.classList.contains('leadership-time-entry-resize-handle') && 
                !e.target.closest('.leadership-time-entry')) {
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp, { once: true });
            }
        });
        
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
        
        grid.appendChild(memberColumn);
    });
    
    // Render existing time entries
    renderAllLeadershipTimeEntries();
}

// Update drag preview (minute-based)
function updateLeadershipDragPreview() {
    // Remove existing previews
    document.querySelectorAll('.leadership-drag-preview').forEach(el => el.remove());
    
    if (!leadershipDragState) return;
    
    const { memberIndex, startMinutes, currentMinutes } = leadershipDragState;
    const start = Math.min(startMinutes, currentMinutes);
    const end = Math.max(startMinutes, currentMinutes);
    const duration = end - start;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    const memberColumn = document.querySelector(`.leadership-member-column[data-member-index="${memberIndex}"]`);
    if (!memberColumn) return;
    
    const preview = document.createElement('div');
    preview.className = 'leadership-time-entry leadership-drag-preview';
    preview.style.top = `${start - 480}px`; // 480 = 8:00 AM in minutes
    preview.style.height = `${duration}px`;
    preview.style.background = 'rgba(100, 200, 255, 0.5)';
    preview.style.border = '2px dashed rgba(100, 200, 255, 0.8)';
    preview.textContent = durationText;
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

// Render all time entries (minute-based)
function renderAllLeadershipTimeEntries() {
    // Clear existing entries
    document.querySelectorAll('.leadership-time-entry:not(.leadership-drag-preview)').forEach(el => el.remove());
    
    // Get current week's days
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    days.forEach((dayName, dayIdx) => {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIdx);
        const dayDateKey = formatDateKey(dayDate, dayName);
        
        // Check all time blocks for this day
        timeBlocks.forEach((block, blockIdx) => {
            const blockKey = `${dayDateKey}-${block.id}`;
            const assignments = schedule[blockKey] || [];
            
            assignments.forEach((assignment, assignmentIdx) => {
                const membersToSearch = isLeadershipMode ? leadershipMembers : teamMembers;
                const memberIndex = membersToSearch.findIndex(m => m.name === assignment.member);
                if (memberIndex === -1) return;
                
                // Parse block times to minutes
                const startParts = block.startTime.split(':');
                const endParts = block.endTime.split(':');
                const startHour = parseInt(startParts[0]);
                const startMin = parseInt(startParts[1] || 0);
                const endHour = parseInt(endParts[0]);
                const endMin = parseInt(endParts[1] || 0);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                const duration = endMinutes - startMinutes;
                
                // Find the member column
                const memberColumn = document.querySelector(`.leadership-member-column[data-member-index="${memberIndex}"]`);
                if (!memberColumn) return;
                
                // Create time entry with minute-based positioning
                const entry = document.createElement('div');
                entry.className = 'leadership-time-entry';
                if (isAdminMode) {
                    entry.classList.add('editable');
                }
                const client = clients.find(c => c.name === assignment.client);
                entry.style.backgroundColor = client ? client.color : '#667eea';
                entry.style.top = `${startMinutes - 480}px`; // 480 = 8:00 AM in minutes
                entry.style.height = `${duration}px`;
                entry.dataset.blockKey = blockKey;
                entry.dataset.assignmentIndex = assignmentIdx;
                entry.dataset.startMinutes = startMinutes;
                entry.dataset.endMinutes = endMinutes;
                entry.dataset.clientName = assignment.client;
                
                const hours = Math.floor(duration / 60);
                const mins = duration % 60;
                const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                
                entry.innerHTML = `
                    ${isAdminMode ? '<div class="leadership-time-entry-resize-handle top"></div>' : ''}
                    <span>${assignment.client} (${durationText})</span>
                    ${isAdminMode ? '<button class="leadership-time-entry-delete" onclick="deleteLeadershipTimeEntry(event, \'' + blockKey + '\', ' + assignmentIdx + ')">&times;</button>' : ''}
                    ${isAdminMode ? '<div class="leadership-time-entry-resize-handle bottom"></div>' : ''}
                `;
                memberColumn.appendChild(entry);
            });
        });
    });
}

// Show client selection modal for leadership mode (minute-based)
function showLeadershipClientModal(memberIndex, startMinutes, endMinutes) {
    if (!isAdminMode) return;
    
    const modal = document.getElementById('leadershipClientModal');
    const clientList = document.getElementById('leadershipClientSelectionList');
    
    clientList.innerHTML = '';
    
    if (clients.length === 0) {
        clientList.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No clients available. Add clients in Settings.</p>';
    } else {
        clients.forEach(client => {
            const option = document.createElement('div');
            option.className = 'client-option';
            option.style.borderColor = client.color;
            option.innerHTML = `
                <div class="client-option-color" style="background-color: ${client.color}"></div>
                <span>${client.name}</span>
            `;
            option.onclick = () => {
                closeLeadershipClientModal();
                createLeadershipTimeEntry(memberIndex, startMinutes, endMinutes, client.name);
            };
            clientList.appendChild(option);
        });
    }
    
    modal.classList.add('show');
    window.leadershipPendingEntry = { memberIndex, startMinutes, endMinutes };
}

// Show edit modal for existing entry
function showLeadershipEditModal(entry) {
    if (!isAdminMode) return;
    
    const blockKey = entry.dataset.blockKey;
    const assignmentIndex = parseInt(entry.dataset.assignmentIndex);
    const assignments = schedule[blockKey] || [];
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
            option.className = 'client-option';
            option.style.borderColor = client.color;
            if (client.name === assignment.client) {
                option.style.opacity = '0.5';
            }
            option.innerHTML = `
                <div class="client-option-color" style="background-color: ${client.color}"></div>
                <span>${client.name}${client.name === assignment.client ? ' (current)' : ''}</span>
            `;
            option.onclick = () => {
                closeLeadershipClientModal();
                assignment.client = client.name;
                saveData();
                renderSidebar(); if (isLeadershipMode) updateStats();
                renderCalendar();
                updateStats();
            };
            clientList.appendChild(option);
        });
    }
    
    modal.classList.add('show');
}

// Close leadership client modal
function closeLeadershipClientModal() {
    const modal = document.getElementById('leadershipClientModal');
    modal.classList.remove('show');
    window.leadershipPendingEntry = null;
}

// Create time entry in leadership mode (minute-based)
function createLeadershipTimeEntry(memberIndex, startMinutes, endMinutes, clientName) {
    if (!isAdminMode || !window.leadershipPendingEntry) return;
    
    const membersToUse = isLeadershipMode ? leadershipMembers : teamMembers;
    const member = membersToUse[memberIndex];
    if (!member) return;
    
    // Convert minutes to time strings
    const startHour = Math.floor(startMinutes / 60);
    const startMin = startMinutes % 60;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;
    const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    
    // Create a unique block ID for this time range
    const blockId = `leadership-${startMinutes}-${endMinutes}`;
    
    // Get current week's days - for now, add to Monday (can be enhanced to allow day selection)
    const dayName = 'Monday';
    const dayDate = new Date(currentWeekStart);
    const dayDateKey = formatDateKey(dayDate, dayName);
    const blockKey = `${dayDateKey}-${blockId}`;
    
    // Check if block exists, if not create it
    let matchingBlock = timeBlocks.find(b => b.id === blockId);
    if (!matchingBlock) {
        matchingBlock = {
            id: blockId,
            label: `${startTime} - ${endTime}`,
            time: `${startTime} - ${endTime}`,
            startTime: startTime,
            endTime: endTime,
            isLunch: false
        };
        timeBlocks.push(matchingBlock);
    }
    
    if (!schedule[blockKey]) {
        schedule[blockKey] = [];
    }
    
    // Check if this exact entry already exists
    const exists = schedule[blockKey].some(a => 
        a.member === member.name && a.client === clientName
    );
    
    if (!exists) {
        saveStateToHistory();
        schedule[blockKey].push({
            member: member.name,
            client: clientName
        });
        saveData();
        renderSidebar(); if (isLeadershipMode) updateStats();
        renderCalendar();
        updateStats();
    }
}

// Delete leadership time entry (global function for onclick)
window.deleteLeadershipTimeEntry = function(event, blockKey, assignmentIndex) {
    if (!isAdminMode) return;
    event.stopPropagation();
    
    saveStateToHistory();
    
    if (schedule[blockKey] && Array.isArray(schedule[blockKey])) {
        schedule[blockKey].splice(assignmentIndex, 1);
        if (schedule[blockKey].length === 0) {
            delete schedule[blockKey];
        }
    }
    
    saveData();
    renderSidebar(); if (isLeadershipMode) updateStats();
    renderCalendar();
    updateStats();
};

