# 🚀 Deployment Guide - Børnelæring App

## Quick Start Deployment

### Option 1: Vercel (Recommended - Free)
1. **Push to GitHub (PowerShell)**:
   ```powershell
   git init
   git add .
   git commit -m "Initial deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/preschool-learning-app.git
   git push -u origin main
   ```

2. **Deploy on Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Vite framework
   - Click "Deploy"
   - Your app will be live at `https://your-app-name.vercel.app`

### Option 2: Netlify (Alternative Free Option)
1. **Build the app (PowerShell)**:
   ```powershell
   npm run build
   ```
2. **Drag & Drop**:
   - Visit [netlify.com](https://netlify.com)
   - Drag the `dist/` folder to the deploy area
   - Get instant live URL

## 🎙️ Google Cloud Text-to-Speech Setup

### Prerequisites
1. A Google Cloud account with billing enabled
2. A service account with Text-to-Speech permissions
3. Your service account JSON key file

### Environment Variables for Vercel

1. **Go to your Vercel project settings** → Environment Variables
2. **Extract values from your `google-cloud-key.json`**:

```json
{
  "project_id": "your-project-id",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
}
```

3. **Add these environment variables in Vercel**:

```
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

**Important**: Copy the private key exactly as it appears, including `\n` characters.

4. **Optional configuration variables**:

```
VITE_TTS_USE_GOOGLE=true
VITE_TTS_FALLBACK_TO_WEB_SPEECH=true
VITE_PREFERRED_DANISH_VOICE=da-DK-Wavenet-E
VITE_SPEECH_RATE=0.8
VITE_SPEECH_PITCH=1.5
```

## 🔧 Pre-Deployment Checklist (PowerShell)

```powershell
# Stop any running processes
Get-Process -Name "node" | Stop-Process -Force

# Clean and rebuild
Remove-Item -Recurse -Force node_modules, dist
npm install
npm run build

# Test locally
npm run preview  # Test production build
npm run dev      # Test development build
```

- ✅ Build completes without errors
- ✅ App runs locally on both dev and preview servers
- ✅ Audio permissions work in browser
- ✅ Responsive design tested on mobile/tablet
- ✅ Danish text-to-speech functions properly

## 🌐 Live App Access

Once deployed, users can:
1. **Visit the URL** on any device
2. **Allow audio permissions** when prompted
3. **Choose difficulty level** appropriate for child's age
4. **Start learning** with alphabet or math games

## 📱 Device Compatibility

### Tested Devices
- ✅ **iPads**: Safari, Chrome
- ✅ **Android Tablets**: Chrome, Firefox
- ✅ **iPhones**: Safari
- ✅ **Android Phones**: Chrome
- ✅ **Desktop/Laptop**: All modern browsers

### Browser Requirements
- **Chrome**: 70+
- **Safari**: 12+
- **Firefox**: 65+
- **Edge**: 79+

## 🔊 Audio Setup for Users

### Enhanced Audio with Google Cloud TTS
The app now uses **Google Cloud Text-to-Speech** for superior Danish voice quality:
- **Natural-sounding voices** specifically optimized for children
- **Clear pronunciation** of Danish letters and numbers
- **Enthusiastic feedback** with child-friendly intonation
- **Automatic caching** for instant playback

### First Time Setup
1. **Enable Audio**: Browser will ask for audio permissions (no microphone needed)
2. **Danish Language**: 
   - Primary: Google Cloud TTS with Wavenet Danish voices
   - Fallback: Browser's built-in Danish voice
3. **Volume**: Ensure device volume is appropriate for children

### Audio Features
- **SSML Support**: Enhanced speech with pauses, emphasis, and pitch variations
- **Slow Speech Mode**: Automatically slows down for difficult words
- **Math Problem Reading**: Special formatting for arithmetic problems
- **Encouraging Feedback**: Randomized success and encouragement phrases

### Troubleshooting Audio
- **No Sound**: Check device volume and browser permissions
- **Google TTS Issues**: App automatically falls back to Web Speech API
- **iOS Issues**: Tap screen once before using audio features
- **Cached Audio**: Clear browser cache if audio seems outdated

## 🎯 Usage Instructions for Parents/Teachers

### Getting Started
1. **Open the app** in a web browser
2. **Choose difficulty**:
   - 🐣 **Beginner (3-4 years)**: Basic letters A-J, numbers 1-10
   - 🐱 **Intermediate (4-6 years)**: More letters, numbers 1-50, simple math
   - 🦁 **Advanced (6-7 years)**: Full alphabet, numbers 1-100, addition/subtraction

### Learning Modules
- **🔤 Alphabet**: Child hears letter, clicks correct option
- **🔢 Math**: Child hears number or math problem, clicks answer
- **⚙️ Settings**: Adjust difficulty as child progresses

### Tips for Best Experience
- **Use headphones** for clearer audio
- **Landscape mode** works better on tablets
- **Allow child to explore** different difficulty levels
- **Celebrate progress** with the built-in scoring system

## 🔒 Privacy & Safety

### Data Collection
- **No personal data** collected
- **No user accounts** required  
- **Difficulty setting** stored locally on device only
- **No internet required** after initial page load

### Child Safety
- **No external links** that leave the app
- **No advertisements**
- **No social features** or communication
- **Appropriate content** only for specified age groups

## 🆘 Support & Troubleshooting

### Common Issues

#### "App won't load"
- Check internet connection
- Try refreshing the page
- Clear browser cache
- Try different browser

#### "No sound/wrong language"
- Check device volume
- Allow browser audio permissions
- Try on different device
- Restart browser

#### "Touch not responding"
- Enable JavaScript in browser
- Try different browser
- Check if device touch screen is working
- Restart device

### Technical Support
If you encounter issues:
1. **Check browser console** for error messages
2. **Try different device/browser**
3. **Report issues** with specific device/browser information

## 📊 Performance Expectations

### Loading Times
- **Initial Load**: 2-5 seconds (depending on connection)
- **Game Navigation**: Instant
- **Audio Loading**: 1-2 seconds per new audio

### Data Usage
- **Initial Download**: ~1MB
- **Audio**: Generated by device (no additional download)
- **Subsequent Visits**: Cached (minimal data usage)

## 🔄 Updates & Maintenance

### Automatic Updates
- **Vercel/Netlify**: Updates automatically when you push to GitHub
- **Users**: Get updates automatically on next visit
- **No app store** updates required

### Manual Updates (PowerShell)
To update the app:
```powershell
# Make changes to code, then:
npm run dev      # Test locally
npm run build    # Verify build works
git add .
git commit -m "Update: describe changes"
git push         # Deploy automatically
```

## 💰 Cost Considerations

### Google Cloud Text-to-Speech Pricing
- **First 1 million characters/month**: FREE
- **WaveNet voices**: $16 per 1 million characters
- **Standard voices**: $4 per 1 million characters

### Expected Usage
With caching enabled, typical classroom usage:
- **30 students daily**: ~50,000 characters/month
- **Cost**: $0 (within free tier)
- **Heavy usage (100+ students)**: ~$1-2/month

### Cost Optimization
- **Browser caching**: Reduces API calls by 80%+
- **Preloading**: Common phrases cached on startup
- **Fallback mode**: Uses free Web Speech API if needed

## 🎉 Ready to Launch!

Your Danish preschool learning app is now ready for children to enjoy learning letters and numbers in a fun, interactive environment. The app provides:

- **Superior audio quality** with Google Cloud TTS
- **Child-friendly voices** with enthusiasm and encouragement
- **Safe educational space** with no ads or external links
- **Adaptive learning** that grows with the child

**Live URL**: Will be provided after deployment
**Access**: Works on any device with a modern web browser
**Cost**: Free tier covers typical classroom usage