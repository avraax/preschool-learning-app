# Vercel Deployment Script for Preschool Learning App

Write-Host "🚀 Starting Vercel deployment..." -ForegroundColor Cyan

# Step 1: Initial deployment
Write-Host "`n📦 Deploying to Vercel..." -ForegroundColor Yellow
Write-Host "Please follow the prompts:" -ForegroundColor Gray
Write-Host "- Set up and deploy? Yes" -ForegroundColor Gray
Write-Host "- Select your scope" -ForegroundColor Gray
Write-Host "- Link to existing project? No" -ForegroundColor Gray
Write-Host "- Project name: preschool-learning-app" -ForegroundColor Gray
Write-Host "- Directory: ./" -ForegroundColor Gray
Write-Host "- Override settings? No" -ForegroundColor Gray

vercel

Write-Host "`n✅ Initial deployment complete!" -ForegroundColor Green
Write-Host "`n⚙️ Now we need to add environment variables..." -ForegroundColor Yellow

# Ask if user wants to continue
$continue = Read-Host "`nDo you want to add environment variables now? (y/n)"
if ($continue -ne 'y') {
    Write-Host "Deployment paused. Run this script again to continue." -ForegroundColor Yellow
    exit
}

# Step 2: Add environment variables
Write-Host "`n🔐 Adding Google Cloud credentials..." -ForegroundColor Cyan

# Project ID
Write-Host "`nAdding GOOGLE_CLOUD_PROJECT_ID..." -ForegroundColor Gray
vercel env add GOOGLE_CLOUD_PROJECT_ID production

# Client Email
Write-Host "`nAdding GOOGLE_CLOUD_CLIENT_EMAIL..." -ForegroundColor Gray
vercel env add GOOGLE_CLOUD_CLIENT_EMAIL production

# Private Key
Write-Host "`nAdding GOOGLE_CLOUD_PRIVATE_KEY..." -ForegroundColor Gray
Write-Host "IMPORTANT: Copy the ENTIRE private key from VERCEL_ENV_VARS.md including BEGIN and END lines" -ForegroundColor Yellow
vercel env add GOOGLE_CLOUD_PRIVATE_KEY production

# Optional configs
Write-Host "`n📋 Adding optional configuration..." -ForegroundColor Cyan

$addOptional = Read-Host "`nAdd optional configuration? (y/n)"
if ($addOptional -eq 'y') {
    vercel env add VITE_TTS_USE_GOOGLE production
    vercel env add VITE_TTS_FALLBACK_TO_WEB_SPEECH production
    vercel env add VITE_PREFERRED_DANISH_VOICE production
    vercel env add VITE_SPEECH_RATE production
    vercel env add VITE_SPEECH_PITCH production
}

# Step 3: Production deployment
Write-Host "`n🚀 Deploying to production with environment variables..." -ForegroundColor Cyan
vercel --prod

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "Your app should now be live with Google Cloud TTS enabled!" -ForegroundColor Green
Write-Host "`nTo view logs: vercel logs" -ForegroundColor Gray
Write-Host "To view function logs: vercel logs --functions" -ForegroundColor Gray