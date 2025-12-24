# GitHub Setup Guide

## Step 1: Install Git (if not already installed)

1. Download Git from: https://git-scm.com/download/win
2. Install with default settings
3. Restart your terminal/command prompt

## Step 2: Initialize Git Repository

Open terminal/command prompt in this folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
```

## Step 3: Create GitHub Repository

1. Go to https://github.com and sign in
2. Click the "+" icon in top right → "New repository"
3. Name it: `team-week-schedule`
4. Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license
6. Click "Create repository"

## Step 4: Connect Local Repository to GitHub

GitHub will show you commands. Run these (replace YOUR_USERNAME with your GitHub username):

```bash
git remote add origin https://github.com/YOUR_USERNAME/team-week-schedule.git
git branch -M main
git push -u origin main
```

## Step 5: Deploy to GitHub Pages (Free Hosting)

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll to "Pages" in left sidebar
4. Under "Source", select "Deploy from a branch"
5. Select "main" branch and "/ (root)" folder
6. **Note:** For GitHub Pages to work with a custom filename, you may need to set up a redirect or use `index.html`. If you want to keep the custom name, users will need to visit: `https://YOUR_USERNAME.github.io/team-week-schedule/Team%20Week%20Schedule%20tool.html`
6. Click "Save"
7. Your site will be live at: `https://YOUR_USERNAME.github.io/team-week-schedule/`

## Important Notes

⚠️ **Current Limitation**: This app uses localStorage, so each user's data is stored locally in their browser. It won't sync between users yet.

🔧 **To Add Multi-User Functionality**: You'll need to add a backend server. See `DEPLOYMENT_OPTIONS.md` for details.

## Future Updates

When you make changes:

```bash
git add .
git commit -m "Description of changes"
git push
```

GitHub Pages will automatically update your live site!

