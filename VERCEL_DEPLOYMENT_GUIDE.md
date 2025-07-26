# Vercel Deployment Guide for Google Cloud TTS

## Step 1: Deploy to Vercel

Run this command in PowerShell:

```powershell
cd C:\Source\Projects\preschool-learning-app
vercel
```

You'll be asked:
1. **Set up and deploy?** → Yes
2. **Which scope?** → Select your account
3. **Link to existing project?** → No (create new)
4. **Project name?** → preschool-learning-app (or your choice)
5. **Directory?** → ./ (current directory)
6. **Override settings?** → No

## Step 2: Add Environment Variables

After initial deployment, add the Google Cloud credentials:

```powershell
# Add required environment variables
vercel env add GOOGLE_CLOUD_PROJECT_ID production
# Enter: preschool-learning-app-466719

vercel env add GOOGLE_CLOUD_CLIENT_EMAIL production
# Enter: tts-service-account@preschool-learning-app-466719.iam.gserviceaccount.com

vercel env add GOOGLE_CLOUD_PRIVATE_KEY production
# Enter the entire private key (copy from VERCEL_ENV_VARS.md)

# Add optional configuration
vercel env add VITE_TTS_USE_GOOGLE production
# Enter: true

vercel env add VITE_TTS_FALLBACK_TO_WEB_SPEECH production
# Enter: true

vercel env add VITE_PREFERRED_DANISH_VOICE production
# Enter: da-DK-Wavenet-F

vercel env add VITE_SPEECH_RATE production
# Enter: 0.9

vercel env add VITE_SPEECH_PITCH production
# Enter: 1.1
```

## Step 3: Deploy with Environment Variables

```powershell
vercel --prod
```

## Alternative: Use Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Find your project
3. Go to Settings → Environment Variables
4. Add each variable from VERCEL_ENV_VARS.md
5. Redeploy from dashboard

## Testing the Deployment

Once deployed, you can:
1. Visit your deployment URL
2. Open browser console (F12)
3. Test the app - you should see:
   - "🎙️ Attempting Google TTS synthesis"
   - "✅ Google TTS synthesis successful"

Instead of the local fallback messages.

## Troubleshooting

If TTS still doesn't work:
1. Check Vercel Functions logs: `vercel logs --functions`
2. Verify environment variables: `vercel env ls`
3. Check browser console for errors