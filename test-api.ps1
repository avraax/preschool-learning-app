# PowerShell script to test the TTS API

$url = "https://preschool-learning-4zrjetfsy-allan-brink-vraas-projects.vercel.app/api/tts"

# Simple test request
$body = @{
    text = "Hej! Dette er en test"
    isSSML = $false
    voice = @{
        languageCode = "da-DK"
        name = "da-DK-Wavenet-A"
        ssmlGender = "FEMALE"
    }
    audioConfig = @{
        audioEncoding = "MP3"
        speakingRate = 0.9
        pitch = 1.1
        volumeGainDb = 0
        sampleRateHertz = 24000
    }
} | ConvertTo-Json -Depth 3

Write-Host "Testing TTS API..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host "Text: 'Hej! Dette er en test'" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
    Write-Host "`n✅ Success! Audio generated:" -ForegroundColor Green
    Write-Host "Voice: $($response.voice.name)" -ForegroundColor Gray
    Write-Host "Text: $($response.text)" -ForegroundColor Gray
    Write-Host "Audio size: $($response.audioContent.Length) characters (base64)" -ForegroundColor Gray
} catch {
    Write-Host "`n❌ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}