# Team Week Schedule

A web application for managing weekly team schedules with drag-and-drop functionality.

## Features

- **Weekly Calendar View**: View and manage schedules for the entire week
- **Time Blocks**:
  - Work Block 1: 11:00 AM - 1:00 PM (EST)
  - Lunch: 1:00 PM - 2:00 PM (EST) - Unavailable
  - Work Block 2: 2:00 PM - 4:00 PM (EST)
  - Work Block 3: 4:00 PM - 6:00 PM (EST)
- **Drag & Drop**: Drag team members from the sidebar to calendar slots
- **Client Assignment**: Assign clients to team members when scheduling
- **Settings Management**: Add, edit, and delete team members and clients
- **Data Persistence**: All data is saved to browser's local storage

## Usage

1. Open `Team Week Schedule tool.html` in a web browser
2. **Add Team Members & Clients**: Click the Settings button (⚙️) to add, edit, or delete team members and clients
3. **Schedule Assignments**: 
   - Drag a team member from the sidebar to any work block slot
   - Select a client from the popup menu
   - The assignment will appear in the calendar
4. **Remove Assignments**: Hover over an assignment and click the × button
5. **Navigate Weeks**: Use the Previous Week and Next Week buttons to navigate between weeks

## Files

- `Team Week Schedule tool.html` - Main HTML structure
- `styles.css` - Styling and layout
- `app.js` - Application logic and functionality

## Browser Compatibility

Works best in modern browsers that support:
- HTML5 Drag and Drop API
- Local Storage
- CSS Grid and Flexbox

## Deployment

### GitHub Pages (Current - Single User)

See `GITHUB_SETUP.md` for instructions on:
- Setting up Git repository
- Connecting to GitHub
- Deploying to GitHub Pages (free hosting)

**Note:** Current version uses localStorage, so data is stored locally per user.

### Multi-User Deployment

To enable multi-user functionality with real-time sync, see `DEPLOYMENT_OPTIONS.md` for backend options including:
- Supabase (recommended - easiest)
- Firebase
- Custom backend solutions




