# Version Bump Script for Børnelæring App
# This script increments the patch version before deployment

Write-Host "🎈 Børnelæring - Version Bump" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Make sure you're in the project root directory." -ForegroundColor Red
    exit 1
}

# Read current version
try {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $currentVersion = $packageJson.version
    Write-Host "📋 Current version: $currentVersion" -ForegroundColor Yellow
    
    # Parse version components
    $versionParts = $currentVersion.Split('.')
    if ($versionParts.Length -ne 3) {
        throw "Invalid version format. Expected x.y.z"
    }
    
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1] 
    $patch = [int]$versionParts[2]
    
    # Increment patch version
    $patch++
    $newVersion = "$major.$minor.$patch"
    
    Write-Host "🔄 Bumping to version: $newVersion" -ForegroundColor Green
    
    # Update package.json
    $packageJson.version = $newVersion
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
    
    Write-Host "✅ Version updated successfully!" -ForegroundColor Green
    Write-Host "📝 Don't forget to commit this change before deploying." -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error updating version: $_" -ForegroundColor Red
    exit 1
}