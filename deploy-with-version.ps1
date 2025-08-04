# Complete Deployment Script with Version Bump for Børnelæring App
# This script bumps version, builds, commits, and deploys to production

Write-Host "🎈 Børnelæring - Complete Deployment" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Make sure you're in the project root directory." -ForegroundColor Red
    exit 1
}

# Step 1: Bump version
Write-Host "`n🔄 Bumping version..." -ForegroundColor Yellow
try {
    .\bump-version.ps1
    if ($LASTEXITCODE -ne 0) {
        throw "Version bump failed"
    }
} catch {
    Write-Host "❌ Error: Version bump failed." -ForegroundColor Red
    exit 1
}

# Step 2: Build the project
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

# Step 3: Deploy to Vercel production
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

$packageJson = Get-Content "package.json" | ConvertFrom-Json
$newVersion = $packageJson.version

Write-Host "`n🌐 Production URL: https://preschool-learning-app.vercel.app/" -ForegroundColor Cyan
Write-Host "🎉 Deployment complete! The app is now live with version v$newVersion." -ForegroundColor Green
Write-Host "📝 Remember to commit the version bump manually: git add package.json src/config/version.ts && git commit && git push" -ForegroundColor Cyan