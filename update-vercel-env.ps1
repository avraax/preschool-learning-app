# PowerShell script to update Vercel environment variables

Write-Host "Updating Vercel environment variables..." -ForegroundColor Cyan

# First, let's check current environment variables
Write-Host "`nCurrent environment variables:" -ForegroundColor Yellow
vercel env ls

# Read the base64 key from file
$base64Key = Get-Content -Path "private-key-base64.txt" -Raw

Write-Host "`nAdding GOOGLE_CLOUD_PRIVATE_KEY_BASE64..." -ForegroundColor Green
Write-Host "Key length: $($base64Key.Length) characters" -ForegroundColor Gray

# Remove old private key if exists
Write-Host "`nRemoving old GOOGLE_CLOUD_PRIVATE_KEY if exists..." -ForegroundColor Yellow
vercel env rm GOOGLE_CLOUD_PRIVATE_KEY production 2>$null

# Add the base64 encoded key
Write-Host "`nAdding new base64 encoded key..." -ForegroundColor Green
$base64Key | vercel env add GOOGLE_CLOUD_PRIVATE_KEY_BASE64 production

Write-Host "`nEnvironment variables updated!" -ForegroundColor Green
Write-Host "Now redeploy with: vercel --prod" -ForegroundColor Cyan