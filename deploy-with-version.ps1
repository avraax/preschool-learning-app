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

# Step 3: Commit version bump
Write-Host "`n📝 Committing version bump..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$newVersion = $packageJson.version
try {
    git add package.json src/config/version.ts
    if ($LASTEXITCODE -ne 0) {
        throw "Git add failed"
    }
    
    $commitMessage = @"
Bump version to v$newVersion

- Version incremented for production deployment
- Build timestamp updated for version tracking
- Version information will be visible in app corner

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
"@
    
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        throw "Git commit failed"
    }
    
    git push origin master
    if ($LASTEXITCODE -ne 0) {
        throw "Git push failed"
    }
    Write-Host "✅ Version bump committed and pushed" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Git operations failed: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Deploy to Vercel production
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

# Step 5: Verify deployment
Write-Host "`n🔍 Verifying deployment..." -ForegroundColor Yellow
$maxRetries = 12
$retryCount = 0
$deploymentVerified = $false

while ($retryCount -lt $maxRetries -and -not $deploymentVerified) {
    try {
        $response = Invoke-RestMethod -Uri "https://preschool-learning-app.vercel.app/version.json" -Method Get
        if ($response.version -eq $newVersion) {
            $deploymentVerified = $true
            Write-Host "✅ Deployment verified! Live version: v$($response.version)" -ForegroundColor Green
        } else {
            Write-Host "⏳ Waiting for deployment to propagate... (Current: v$($response.version), Expected: v$newVersion)" -ForegroundColor Yellow
            Start-Sleep -Seconds 10
            $retryCount++
        }
    } catch {
        Write-Host "⏳ Waiting for deployment to become available..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        $retryCount++
    }
}

if (-not $deploymentVerified) {
    Write-Host "Warning: Could not verify deployment within expected time. Please check manually." -ForegroundColor Yellow
}

Write-Host "`nProduction URL: https://preschool-learning-app.vercel.app/" -ForegroundColor Cyan
Write-Host "Deployment complete! The app is now live with version v$newVersion." -ForegroundColor Green