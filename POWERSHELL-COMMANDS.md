# 💻 PowerShell Commands Reference - Børnelæring App

## 🚀 Quick Start Commands

### Initial Setup
```powershell
# Clone or navigate to project
cd C:\Source\Projects\preschool-learning-app

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔧 Development Commands

### Basic Development Workflow
```powershell
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

### Process Management
```powershell
# Stop all Node.js processes
Get-Process -Name "node" | Stop-Process -Force

# Check what's running on port 5173
netstat -ano | findstr :5173

# Stop specific process by PID (replace 1234 with actual PID)
Stop-Process -Id 1234 -Force

# Check all running Node processes
Get-Process -Name "node"
```

### Clean Development Environment
```powershell
# Full clean and restart
Get-Process -Name "node" | Stop-Process -Force
Remove-Item -Recurse -Force node_modules, dist
npm install
npm run dev

# Quick clean (just build artifacts)
Remove-Item -Recurse -Force dist
npm run build
```

## 📁 File & Directory Operations

### Project Structure Management
```powershell
# View project structure
Get-ChildItem -Recurse -Directory | Select-Object FullName

# Check file sizes in dist folder
Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum

# Find TypeScript files
Get-ChildItem -Path "src" -Filter "*.tsx" -Recurse

# Check package.json scripts
Get-Content package.json | ConvertFrom-Json | Select-Object -ExpandProperty scripts
```

### Backup and Restore
```powershell
# Create backup of current state
Copy-Item -Path "." -Destination "../preschool-learning-app-backup" -Recurse -Force

# Restore from backup
Remove-Item -Recurse -Force *
Copy-Item -Path "../preschool-learning-app-backup/*" -Destination "." -Recurse -Force
```

## 🌐 Git Operations

### Repository Management
```powershell
# Initialize and first commit
git init
git add .
git commit -m "Initial commit"

# Connect to remote repository
git remote add origin https://github.com/YOUR_USERNAME/preschool-learning-app.git
git branch -M main
git push -u origin main

# Feature branch workflow
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# Merge and cleanup
git checkout main
git merge feature/new-feature
git push origin main
git branch -d feature/new-feature
```

### Quick Deployment
```powershell
# Quick commit and deploy
git add .
git commit -m "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push
```

## 🐛 Debugging & Troubleshooting

### Common Issues Resolution
```powershell
# Port already in use
netstat -ano | findstr :5173
# Then kill the process using the PID shown

# Module resolution issues
Remove-Item -Recurse -Force node_modules
npm cache clean --force
npm install

# TypeScript compilation errors
npx tsc --noEmit  # Check types without building

# Vite cache issues
Remove-Item -Recurse -Force .vite
npm run dev
```

### Performance Monitoring
```powershell
# Check Node.js memory usage
Get-Process -Name "node" | Select-Object ProcessName, WorkingSet, CPU

# Monitor file changes
Get-ChildItem -Path "src" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 10

# Check bundle size after build
Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum | ForEach-Object { [Math]::Round($_.Sum / 1MB, 2) }
```

## 🎯 Testing Commands

### Local Testing
```powershell
# Test development build
Start-Process "http://localhost:5173"

# Test production build
npm run build
npm run preview
Start-Process "http://localhost:4173"

# Test responsive design (open multiple browsers)
Start-Process "chrome" "http://localhost:5173"
Start-Process "msedge" "http://localhost:5173"
```

### Audio Testing
```powershell
# Check if audio devices are available
Get-WmiObject -Class Win32_SoundDevice | Select-Object Name, Status

# Test Danish language support
# (Manual browser check required)
Write-Host "Test Danish audio in browser: Hej, hvordan har du det?"
```

## 📦 Build & Deployment

### Production Build
```powershell
# Clean build
Remove-Item -Recurse -Force dist
npm run build

# Verify build output
Get-ChildItem -Path "dist" -Recurse
Write-Host "Build size: $((Get-ChildItem -Path 'dist' -Recurse | Measure-Object -Property Length -Sum).Sum / 1KB) KB"

# Test build locally
npm run preview
```

### Deployment Preparation
```powershell
# Pre-deployment checklist
npm run build
if ($?) { Write-Host "✅ Build successful" } else { Write-Host "❌ Build failed" }

npm run lint
if ($?) { Write-Host "✅ Linting passed" } else { Write-Host "❌ Linting failed" }

# Deploy to Vercel (after connecting to GitHub)
git add .
git commit -m "Deploy: $(Get-Date -Format 'yyyy-MM-dd')"
git push
```

## 🔍 Monitoring & Logs

### Development Monitoring
```powershell
# Watch for file changes
Get-ChildItem -Path "src" -Recurse -File | ForEach-Object { $_.LastWriteTime }

# Monitor console output (in separate terminal)
npm run dev 2>&1 | Tee-Object -FilePath "dev.log"

# Check error logs
if (Test-Path "dev.log") { Get-Content "dev.log" | Select-String "ERROR" }
```

## ⚡ Quick Shortcuts

### One-liners for Common Tasks
```powershell
# Restart development server
Get-Process -Name "node" | Stop-Process -Force; npm run dev

# Quick rebuild
Remove-Item -Recurse -Force dist; npm run build

# Full reset
Get-Process -Name "node" | Stop-Process -Force; Remove-Item -Recurse -Force node_modules, dist; npm install; npm run dev

# Check project health
npm run build; if ($?) { npm run preview; Start-Process "http://localhost:4173" }

# Deploy quickly
git add .; git commit -m "Quick update"; git push
```

## 📋 Daily Development Workflow

```powershell
# Morning startup
cd C:\Source\Projects\preschool-learning-app
git pull                    # Get latest changes
npm install                 # Update dependencies if needed
npm run dev                 # Start development

# During development
# Make changes, then test:
# Ctrl+C to stop server
npm run build              # Verify build works
npm run dev                # Restart development

# End of day
git add .
git commit -m "Progress: describe what you worked on"
git push
Get-Process -Name "node" | Stop-Process -Force  # Clean shutdown
```

This reference provides all PowerShell commands needed for efficient development of the Danish preschool learning app on Windows.