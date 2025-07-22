# PowerShell script to encode private key for Vercel

$jsonFile = Get-Content -Path "google-cloud-key.json" | ConvertFrom-Json
$privateKey = $jsonFile.private_key

Write-Host "Original private key (first 50 chars):" -ForegroundColor Yellow
Write-Host $privateKey.Substring(0, 50) -ForegroundColor Gray

# Convert to base64
$base64Key = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($privateKey))

Write-Host "`nBase64 encoded key:" -ForegroundColor Green
Write-Host $base64Key -ForegroundColor Gray

Write-Host "`nTo use this:" -ForegroundColor Cyan
Write-Host "1. Copy the base64 string above" -ForegroundColor Gray
Write-Host "2. Set GOOGLE_CLOUD_PRIVATE_KEY_BASE64 in Vercel to this value" -ForegroundColor Gray
Write-Host "3. We'll decode it in the API function" -ForegroundColor Gray

# Save to file for easy copying
$base64Key | Out-File -FilePath "private-key-base64.txt" -NoNewline
Write-Host "`nBase64 key also saved to: private-key-base64.txt" -ForegroundColor Green