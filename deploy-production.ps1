# Manual Production Deployment Script for Børnelæring App
# Run this script to deploy to production: .\deploy-production.ps1

Write-Host "🎈 Børnelæring - Manual Production Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Make sure you're in the project root directory." -ForegroundColor Red
    exit 1
}

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Node.js not found. Please install Node.js." -ForegroundColor Red
    exit 1
}

# Step 1: Build the project
Write-Host "`n📦 Building project..." -ForegroundColor Yellow
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host "✅ Build successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Build failed. Please fix any errors and try again." -ForegroundColor Red
    exit 1
}

# Step 2: Deploy to Vercel production
Write-Host "`n🚀 Deploying to production..." -ForegroundColor Yellow
try {
    npx vercel --prod --yes
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed"
    }
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Deployment failed. Please check your Vercel configuration." -ForegroundColor Red
    exit 1
}

Write-Host "`n🌐 Production URL: https://preschool-learning-app.vercel.app/" -ForegroundColor Cyan
Write-Host "🎉 Deployment complete! The app is now live." -ForegroundColor Green