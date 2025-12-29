// Data storage
let teamMembers = []; // Format: [{ name: "John", color: "#ce2828", profilePicture: "data:image/..." }, ...]
let clients = []; // Format: [{ name: "Client A", color: "#667eea" }, ...]
let schedule = {}; // Format: { "2024-01-15-Monday-Work1": [{ member: "John", client: "Client A" }, ...] }
let currentWeekStart = new Date();
let isDarkTheme = true; // Default to dark theme
let timeBlocks = []; // Format: [{ id: 'Work1', label: 'Work Block 1', time: '11:00 AM - 1:00 PM', startTime: '11:00', endTime: '13:00', isLunch: false }, ...]
let isAdminMode = false; // View mode by default
const ADMIN_PASSWORD = 'Ravie2026';
let weeklyTimeTracking = {}; // Format: { "2024-01-15": { "John": { "Client A": 5.5 }, ... }, ... }

// Undo/Redo system
let undoHistory = [];
let maxHistorySize = 50;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing app...');
    await loadData();
    initializeCalendar();
    setupEventListeners();
    renderSidebar();
    renderSettings();
    updateStats();
    setupRealtimeSubscriptions();
    renderTimeTracking();
    console.log('✅ App initialized');
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
            console.log('📢 Real-time update: app_settings changed', payload.eventType);
            await loadAppSettings();
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
                } else if (setting.key === 'currentWeekStart') {
                    currentWeekStart = new Date(setting.value);
                } else if (setting.key === 'isDarkTheme') {
                    isDarkTheme = setting.value;
                }
            });
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

        if (!currentWeekStart) {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            currentWeekStart = new Date(today.setDate(diff));
            currentWeekStart.setHours(0, 0, 0, 0);
            await saveAppSettings();
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
    }
}

// Load data from Supabase (with localStorage fallback)
async function loadData() {
    console.log('📥 Loading data from Supabase...');
    console.log('Supabase available:', typeof supabase !== 'undefined');
    
    await loadTeamMembers();
    console.log('Loaded team members:', teamMembers.length);
    
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
        const settings = [
            { key: 'timeBlocks', value: timeBlocks },
            { key: 'currentWeekStart', value: currentWeekStart.toISOString() },
            { key: 'isDarkTheme', value: isDarkTheme }
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
        localStorage.setItem('currentWeekStart', currentWeekStart.toISOString());
        localStorage.setItem('isDarkTheme', isDarkTheme);
    }
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

    days.forEach((day, dayIndex) => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';

        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIndex);
        const dateKey = formatDateKey(dayDate, day);

        timeBlocks.forEach((block, blockIndex) => {
            const timeBlock = document.createElement('div');
            timeBlock.className = `time-block ${block.id === 'Lunch' ? 'lunch' : 'work-block'}`;
            
            if (block.id === 'Lunch') {
                timeBlock.textContent = 'Lunch (Unavailable)';
            } else {
                const blockKey = `${dateKey}-${block.id}`;
                const assignments = schedule[blockKey] || [];

                // Create assignments container
                const assignmentsContainer = document.createElement('div');
                assignmentsContainer.className = 'assignments-container';

                assignments.forEach((assignment, assignmentIndex) => {
                    const member = teamMembers.find(m => m.name === assignment.member);
                    const client = clients.find(c => c.name === assignment.client);
                    const memberColor = member ? member.color : '#ce2828';
                    const clientColor = client ? client.color : '#667eea';
                    const profilePicture = member && member.profilePicture ? member.profilePicture : '';

                    const assignmentDiv = document.createElement('div');
                    assignmentDiv.className = 'assignment';
                    assignmentDiv.draggable = isAdminMode;
                    assignmentDiv.dataset.sourceBlock = blockKey;
                    assignmentDiv.dataset.assignmentIndex = assignmentIndex;
                    assignmentDiv.innerHTML = `
                        <div class="assignment-container" style="border-radius: 50px;">
                            <div class="assignment-member-section" style="background-color: ${memberColor}">
                                <div class="assignment-member-circle">
                                    ${profilePicture ? 
                                        `<img src="${profilePicture}" alt="${assignment.member}" class="assignment-profile-picture">` : 
                                        `<span class="assignment-member-initial">${assignment.member.charAt(0).toUpperCase()}</span>`
                                    }
                                </div>
                                <div class="assignment-member-box">
                                    <span class="assignment-member-name">${assignment.member}</span>
                                </div>
                            </div>
                            <div class="assignment-client-box" style="background-color: ${clientColor}">
                                <span class="assignment-client-name">${assignment.client}</span>
                                ${isAdminMode ? `<button class="assignment-remove" onclick="removeAssignment('${blockKey}', ${assignmentIndex})">×</button>` : ''}
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
                            editAssignmentClient(blockKey, assignmentIndex, assignment);
                        });
                    }
                    
                    // Add drag event listeners (only in admin mode)
                    if (isAdminMode) {
                        assignmentDiv.addEventListener('dragstart', (e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                                sourceBlock: blockKey,
                                assignmentIndex: assignmentIndex,
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
                            editAssignmentClient(blockKey, assignmentIndex, assignment);
                        });
                    }
                    
                    assignmentsContainer.appendChild(assignmentDiv);
                });

                timeBlock.appendChild(assignmentsContainer);

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

// Render sidebar
function renderSidebar() {
    const membersList = document.getElementById('teamMembersList');
    const clientsList = document.getElementById('clientsList');

    membersList.innerHTML = '';
    teamMembers.forEach(member => {
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
    const clientsList = document.getElementById('clientsSettingsList');

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
                <button class="btn-edit" onclick="editClient(${index})" ${disabledAttr}>Edit</button>
                <button class="btn-delete" onclick="deleteClient(${index})" ${disabledAttr}>Delete</button>
            </div>
        `;
        clientsList.appendChild(item);
    });
    
    // Render time tracking section
    renderTimeTracking();
}

// Calculate assigned hours for a week
function calculateAssignedHours(weekStart) {
    const assignedHours = {}; // { memberName: { clientName: hours } }
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    days.forEach((day, dayIndex) => {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + dayIndex);
        const dateKey = formatDateKey(dayDate, day);
        
        timeBlocks.forEach(block => {
            if (block.isLunch) return;
            
            const blockKey = `${dateKey}-${block.id}`;
            const assignments = schedule[blockKey] || [];
            
            // Calculate hours for this block
            const startHour = parseInt(block.startTime.split(':')[0]);
            const endHour = parseInt(block.endTime.split(':')[0]);
            const blockHours = endHour - startHour;
            
            assignments.forEach(assignment => {
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
    
    // Set default week to current week
    const weekInput = document.getElementById('timeTrackingWeek');
    if (weekInput && !weekInput.value) {
        const year = currentWeekStart.getFullYear();
        const week = getWeekNumber(currentWeekStart);
        weekInput.value = `${year}-W${String(week).padStart(2, '0')}`;
    }
    
    const selectedWeek = weekInput ? weekInput.value : null;
    if (!selectedWeek) {
        timeTrackingContent.innerHTML = '<p style="padding: 1rem; color: var(--dark-text);">Please select a week to view time tracking.</p>';
        return;
    }
    
    // Parse week string (YYYY-Www)
    const [year, weekStr] = selectedWeek.split('-W');
    const week = parseInt(weekStr);
    
    // Calculate week start date (Monday of that week)
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
    
    // Calculate assigned hours from schedule
    const assignedHours = calculateAssignedHours(weekStart);
    const weekKey = getWeekKey(weekStart);
    const actualHours = weeklyTimeTracking[weekKey] || {};
    
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
        
        html += `<div class="time-tracking-member-panel">
            <div class="member-panel-header" style="background-color: ${memberColor}">
                <h4>${member.name}</h4>
                <div class="member-totals">
                    <span>Total Assigned: ${totalAssigned.toFixed(1)}h</span>
                    <span>Total Actual: ${totalActual.toFixed(1)}h</span>
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
                    <label>Actual:</label>
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
                        <label>Actual:</label>
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
    // Settings modal
    document.getElementById('settingsBtn').addEventListener('click', () => {
        if (!isAdminMode) {
            // Show admin login modal instead
            document.getElementById('adminModal').classList.add('show');
        } else {
            document.getElementById('settingsModal').classList.add('show');
            renderSettings();
        }
    });

    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('show');
    });

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

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        const settingsModal = document.getElementById('settingsModal');
        const clientModal = document.getElementById('clientModal');
        const adminModal = document.getElementById('adminModal');
        const watermarkModal = document.getElementById('watermarkModal');
        if (e.target === settingsModal) {
            settingsModal.classList.remove('show');
        }
        if (e.target === clientModal) {
            closeClientModal();
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

    // Week navigation
    document.getElementById('prevWeek').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        saveData();
        renderCalendar();
        updateWeekDisplay();
    });

    document.getElementById('nextWeek').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        saveData();
        renderCalendar();
        updateWeekDisplay();
    });

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
    
    // Time tracking week selector
    const timeTrackingWeek = document.getElementById('timeTrackingWeek');
    if (timeTrackingWeek) {
        timeTrackingWeek.addEventListener('change', () => {
            renderTimeTracking();
        });
    }
}

// Update week display
function updateWeekDisplay() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 4); // Monday to Friday (5 days)
    
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const startStr = currentWeekStart.toLocaleDateString('en-US', options);
    const endStr = weekEnd.toLocaleDateString('en-US', options);
    
    document.getElementById('weekDisplay').textContent = `${startStr} - ${endStr} (EST)`;
}

// Update member color
function updateMemberColor(index, color) {
    if (!isAdminMode) return;
    teamMembers[index].color = color;
    saveData();
    renderSidebar();
    renderCalendar();
    updateStats();
}

// Update member profile picture
function updateMemberProfile(index, input) {
    if (!isAdminMode) return;
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            teamMembers[index].profilePicture = e.target.result;
            saveData();
            renderSidebar();
            renderSettings();
            renderCalendar();
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
        
        saveData();
        renderSidebar();
        renderSettings();
        renderCalendar();
        updateStats();
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
    
    // Each work block is 2 hours
    const hoursPerBlock = 2;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const workBlocks = ['Work1', 'Work2', 'Work3'];
    
    // Initialize counters
    teamMembers.forEach(member => {
        personHours[member.name] = 0;
    });
    
    clients.forEach(client => {
        clientHours[client.name] = 0;
    });
    
    // Count hours from schedule
    Object.keys(schedule).forEach(blockKey => {
        const assignments = schedule[blockKey];
        if (Array.isArray(assignments)) {
            assignments.forEach(assignment => {
                if (personHours.hasOwnProperty(assignment.member)) {
                    personHours[assignment.member] += hoursPerBlock;
                }
                if (clientHours.hasOwnProperty(assignment.client)) {
                    clientHours[assignment.client] += hoursPerBlock;
                }
            });
        }
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

