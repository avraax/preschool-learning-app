# PowerShell script to run local development with Google TTS

Write-Host "🚀 Starting Local Development with Google TTS..." -ForegroundColor Cyan

# Check if google-cloud-key.json exists
if (-not (Test-Path "google-cloud-key.json")) {
    Write-Host "❌ Error: google-cloud-key.json not found!" -ForegroundColor Red
    Write-Host "Make sure the Google Cloud key file is in the project root." -ForegroundColor Yellow
    exit 1
}

# Install dependencies if needed
if (-not (Test-Path "node_modules/express")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "🏗️ Building the app..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "🎙️ Starting development server with Google TTS..." -ForegroundColor Green
Write-Host "📱 Local app: http://localhost:3001" -ForegroundColor Gray
Write-Host "🧪 TTS test: http://localhost:3001/test-from-app.html" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray

node dev-server.js