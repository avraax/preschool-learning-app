# PowerShell script to run development with hot reloading and Google TTS
# This runs both Vite dev server and TTS API server concurrently

Write-Host "🚀 Starting Development with Hot Reloading and Google TTS..." -ForegroundColor Cyan

# Check if google-cloud-key.json exists
if (-not (Test-Path "google-cloud-key.json")) {
    Write-Host "❌ Error: google-cloud-key.json not found!" -ForegroundColor Red
    Write-Host "Make sure the Google Cloud key file is in the project root." -ForegroundColor Yellow
    exit 1
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Function to check if port is in use
function Test-Port {
    param($Port)
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Check if ports are available
if (Test-Port 5173) {
    Write-Host "⚠️  Port 5173 is already in use. Stopping existing process..." -ForegroundColor Yellow
    Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*vite*" } | Stop-Process -Force
    Start-Sleep -Seconds 2
}

if (Test-Port 3001) {
    Write-Host "⚠️  Port 3001 is already in use. Stopping existing process..." -ForegroundColor Yellow
    Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*dev-server*" } | Stop-Process -Force
    Start-Sleep -Seconds 2
}

Write-Host "`n🎯 Starting servers..." -ForegroundColor Green
Write-Host "📱 Vite dev server: http://localhost:5173 (with hot reloading)" -ForegroundColor Cyan
Write-Host "🎙️  TTS API server: http://localhost:3001/api/tts" -ForegroundColor Cyan
Write-Host "🧪 TTS test page: http://localhost:3001/test-from-app.html" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop all servers" -ForegroundColor Gray

# Create a job for the TTS server with nodemon for hot reloading
$ttsJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npx nodemon dev-server.js --watch dev-server.js --watch shared-tts-config.js --watch src/services/googleTTS.ts
}

# Create a job for the Vite dev server with proxy configuration
$viteJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    # Set environment variable for proxy
    $env:VITE_API_URL = "http://localhost:3001"
    npm run dev
}

Write-Host "`n📊 Servers starting up..." -ForegroundColor Yellow

# Monitor both jobs
try {
    while ($true) {
        # Check if either job has failed
        if ($ttsJob.State -eq "Failed") {
            Write-Host "`n❌ TTS server failed!" -ForegroundColor Red
            Receive-Job $ttsJob
            break
        }
        
        if ($viteJob.State -eq "Failed") {
            Write-Host "`n❌ Vite server failed!" -ForegroundColor Red
            Receive-Job $viteJob
            break
        }
        
        # Display any output from the jobs
        $ttsOutput = Receive-Job $ttsJob
        if ($ttsOutput) {
            $ttsOutput | ForEach-Object { Write-Host "[TTS] $_" -ForegroundColor DarkGray }
        }
        
        $viteOutput = Receive-Job $viteJob
        if ($viteOutput) {
            $viteOutput | ForEach-Object { Write-Host "[Vite] $_" -ForegroundColor DarkGray }
        }
        
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n🛑 Stopping servers..." -ForegroundColor Yellow
    
    # Stop the jobs
    Stop-Job $ttsJob -ErrorAction SilentlyContinue
    Stop-Job $viteJob -ErrorAction SilentlyContinue
    Remove-Job $ttsJob -ErrorAction SilentlyContinue
    Remove-Job $viteJob -ErrorAction SilentlyContinue
    
    # Kill any remaining node processes
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 
        $_.CommandLine -like "*vite*" -or $_.CommandLine -like "*dev-server*" 
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Write-Host "✅ All servers stopped" -ForegroundColor Green
}