# 🚀 Push to GitHub - Step by Step Guide

## ✅ What We've Done So Far

1. ✅ Updated `.gitignore` to exclude sensitive files (`.env`, `venv/`, `*.pkl`, etc.)
2. ✅ Created `.env.example` files for both frontend and backend
3. ✅ Initialized git repository
4. ✅ Added all files to git
5. ✅ Created initial commit

## 📋 Next Steps to Push to GitHub

### Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Click the **"+"** icon in top right → **"New repository"**
3. Fill in repository details:
   - **Repository name**: `evalmodel` (or your preferred name)
   - **Description**: "AI Model Evaluation Platform with SMCP Pipeline - Compare ML models across frameworks"
   - **Visibility**: 
     - ✅ **Public** (recommended for collaboration)
     - Or **Private** if you want to keep it private initially
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click **"Create repository"**

### Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Run these in PowerShell:

```powershell
# Set your GitHub username and email (replace with YOUR details)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Add GitHub repository as remote origin (REPLACE with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/evalmodel.git

# Rename branch to main (GitHub's default)
git branch -M main

# Push code to GitHub
git push -u origin main
```

**Important**: Replace `YOUR_USERNAME` with your actual GitHub username!

### Step 3: Verify Push

1. Refresh your GitHub repository page
2. You should see all files uploaded
3. Check that README.md displays properly

## 🔐 Security Checklist Before Pushing

### ⚠️ CRITICAL - Verify These Files Are NOT Being Pushed:

```powershell
# Check what files will be pushed
git status

# Make sure these are NOT listed:
# ❌ .env
# ❌ backend/.env  
# ❌ backend/venv/
# ❌ node_modules/
# ❌ Any .pkl, .pt, .h5 model files
```

### ✅ Verify .gitignore is Working

```powershell
# This command should show ONLY safe files
git ls-files

# If you see .env or venv/ in the list, STOP and run:
git rm --cached .env
git rm --cached backend/.env
git rm -r --cached backend/venv
git commit -m "Remove sensitive files from tracking"
```

## 👥 Invite Your Friend to Collaborate

### Option 1: Add as Collaborator (Recommended)

1. Go to your GitHub repository
2. Click **Settings** tab
3. Click **Collaborators** in left sidebar
4. Click **Add people**
5. Enter your friend's GitHub username
6. They'll receive an invitation email

**Permissions**: They can push, pull, and merge directly.

### Option 2: Fork and Pull Request Workflow

1. Your friend forks your repository
2. They clone their fork
3. Make changes in their fork
4. Submit Pull Request to your repository
5. You review and merge

**Permissions**: More controlled, good for open-source projects.

## 📝 Setup Instructions for Your Friend

Share this with your collaborator:

### For Your Friend to Clone and Setup:

```powershell
# Clone the repository (replace with actual URL)
git clone https://github.com/YOUR_USERNAME/evalmodel.git
cd evalmodel

# Follow SETUP.md for complete installation
# Key steps:

# 1. Backend Setup
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy .env.example and configure
cp .env.example .env
# Edit .env with Supabase credentials

# Start backend
python -m uvicorn main:app --reload

# 2. Frontend Setup (in new terminal)
cd ..
npm install

# Copy .env.example and configure
cp .env.example .env
# Edit .env with Supabase credentials

# Start frontend
npm run dev
```

## 🔄 Git Workflow for Collaboration

### Daily Workflow

```powershell
# Before starting work - pull latest changes
git pull origin main

# Create a feature branch (optional but recommended)
git checkout -b feature/your-feature-name

# Make your changes...

# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add: description of what you added"

# Push to GitHub
git push origin main
# OR if using feature branch:
git push origin feature/your-feature-name
```

### Commit Message Conventions

```
Add: new feature or file
Fix: bug fix
Update: modify existing feature
Remove: delete code/files
Docs: documentation changes
Style: formatting, no code change
Refactor: code restructuring
Test: add or update tests
```

**Examples**:
```bash
git commit -m "Add: SMCP evaluation metrics for regression models"
git commit -m "Fix: Compare page blank screen issue"
git commit -m "Update: README with deployment instructions"
git commit -m "Docs: Add setup guide for Windows users"
```

## 🌿 Recommended Branch Strategy

### For Small Team (2-3 people):

**Simple Flow**:
```
main (production-ready code)
  ↓
feature branches → merge to main
```

```powershell
# Create feature branch
git checkout -b feature/compare-page-improvements

# Work on feature...

# When done, push and create Pull Request
git push origin feature/compare-page-improvements
```

### For Larger Team:

**Git Flow**:
```
main (production)
  ↓
develop (integration)
  ↓
feature branches
```

## 🐛 Common Issues & Solutions

### Issue 1: "Permission denied" when pushing

**Solution**: Set up SSH key or use Personal Access Token

```powershell
# Using Personal Access Token (easier)
# 1. Go to GitHub → Settings → Developer settings → Personal access tokens
# 2. Generate new token with 'repo' scope
# 3. Use token as password when pushing

# OR set up SSH (more secure)
ssh-keygen -t ed25519 -C "your.email@example.com"
# Follow GitHub's SSH setup guide
```

### Issue 2: "Repository not found"

**Solution**: Check remote URL

```powershell
# View current remote
git remote -v

# Update if wrong
git remote set-url origin https://github.com/YOUR_USERNAME/evalmodel.git
```

### Issue 3: Merge conflicts

**Solution**: 
```powershell
# Pull latest changes
git pull origin main

# If conflicts occur, Git will mark them in files:
# <<<<<<< HEAD
# Your changes
# =======
# Their changes
# >>>>>>> main

# Edit files to resolve conflicts
# Then:
git add .
git commit -m "Resolve merge conflicts"
git push origin main
```

### Issue 4: Accidentally committed .env file

**Solution**:
```powershell
# Remove from Git but keep locally
git rm --cached .env
git rm --cached backend/.env

# Commit the removal
git commit -m "Remove .env files from tracking"

# Update .gitignore to prevent future commits
# Then push
git push origin main
```

## 📚 Useful Git Commands Reference

```powershell
# Check status
git status

# View commit history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes (CAREFUL!)
git reset --hard HEAD

# View changes before committing
git diff

# Create and switch to new branch
git checkout -b branch-name

# Switch to existing branch
git checkout branch-name

# List all branches
git branch -a

# Delete local branch
git branch -d branch-name

# Pull latest changes
git pull origin main

# Push changes
git push origin main
```

## 🎯 Quick Start Commands

Copy and run these (replace YOUR_USERNAME):

```powershell
# Configure Git (one-time setup)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/evalmodel.git
git branch -M main
git push -u origin main
```

## ✅ Final Checklist

Before sharing with your friend:

- [ ] Repository created on GitHub
- [ ] Code pushed successfully
- [ ] .env files NOT in repository (check GitHub web interface)
- [ ] README.md displays correctly
- [ ] SETUP.md is accessible
- [ ] Friend invited as collaborator
- [ ] .env.example files are present
- [ ] requirements.txt is up to date
- [ ] package.json is complete

## 🎉 You're Ready!

Your code is now on GitHub and ready for collaboration! 

**Next Steps**:
1. Share repository URL with your friend
2. Point them to SETUP.md
3. Ensure they have Supabase credentials
4. Start collaborating!

---

**Repository URL Format**: 
```
https://github.com/YOUR_USERNAME/evalmodel
```

**Clone Command for Your Friend**:
```bash
git clone https://github.com/YOUR_USERNAME/evalmodel.git
```

Happy coding! 🚀
