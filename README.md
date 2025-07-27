# 🎈 Børnelæring - Danish Preschool Learning App

A fun and interactive web application designed to teach Danish children aged 3-7 years the alphabet, basic reading skills, and mathematics.

## 🌟 Features

### 📚 Learning Modules
- **Alphabet Learning**: Interactive letter recognition from A to Å
- **Mathematics**: Counting from 1-100 and basic arithmetic operations
- **Difficulty Levels**: Age-appropriate content for 3-4, 4-6, and 6-7 year olds

### 🎵 Advanced Audio System
- **Global Permission Management**: Smart, session-based audio permission handling
- **High-Quality Danish TTS**: Google Cloud Wavenet voices with child-friendly speech patterns
- **Multi-Tier Fallback**: Google TTS → Web Speech API → Howler.js for maximum compatibility
- **Interactive Audio**: Letters, numbers, and instructions read aloud automatically
- **Intelligent Caching**: Fast audio playback with 24-hour localStorage cache
- **Cross-Platform**: Optimized for iOS Safari and desktop browsers
- **Beautiful Permission UI**: Elegant modal with Danish instructions (shown only once per session)

### 🎨 Kid-Friendly Design
- **Colorful Interface**: Bright, appealing colors and animations
- **Large Touch Targets**: Optimized for tablets and mobile devices
- **Smooth Animations**: Powered by Framer Motion
- **Responsive Design**: Works on phones, tablets, and computers

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation (PowerShell)
1. Clone the repository
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Start the development server:
   ```powershell
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser

### Building for Production (PowerShell)
```powershell
npm run build
```

## 🛠️ Tech Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Audio**: Global Permission System + Google Cloud TTS + Web Speech API + Howler.js
- **Deployment**: Vercel

## 🎯 Difficulty Levels

### 🐣 Beginner (3-4 years)
- Letters A-J
- Numbers 1-10
- Basic recognition only

### 🐱 Intermediate (4-6 years)  
- Letters A-T (uppercase and lowercase)
- Numbers 1-50
- Simple addition

### 🦁 Advanced (6-7 years)
- Full Danish alphabet (A-Å)
- Numbers 1-100
- Addition and subtraction

## 🌐 Deployment

The app is configured for easy deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the Vite framework
3. Deploy with default settings

## 📱 Browser Support

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## 🔊 Audio System

The app features a sophisticated multi-tier audio system for the best Danish learning experience:

### Automatic Audio Permission Management
- **Smart Detection**: Automatically detects when audio is needed
- **Session-Based**: Permission prompt appears only once per session
- **Non-Intrusive**: Beautiful modal instead of annoying browser prompts
- **iOS Optimized**: Enhanced compatibility with iOS Safari restrictions

### Audio Technology Stack
- **Primary**: Google Cloud Text-to-Speech with Danish Wavenet voices
- **Fallback**: Browser Web Speech API with Danish locale
- **Sound Effects**: Howler.js for game sounds and music
- **Caching**: Intelligent 24-hour cache for instant audio playback

### Requirements
- Modern browser (Chrome 70+, Firefox 65+, Safari 12+, Edge 79+)
- Audio permissions (automatically requested when needed)
- Internet connection for first-time audio generation (cached afterward)

## 🎮 How to Use

1. **Start Playing**: Open the app and choose Alphabet or Math
2. **Audio Setup**: If prompted, click "Aktivér lyd" to enable audio (happens once per session)
3. **Listen & Learn**: Audio instructions play automatically - no need to click audio buttons
4. **Interactive Play**: Tap/click on letters, numbers, or answers to play and learn
5. **Progress**: Track your score as you learn with encouraging Danish feedback

### First-Time Experience
- When you first use audio features, you'll see a beautiful purple modal asking to enable audio
- Click "Tryk for at aktivere lyd" to start enjoying full Danish narration
- This permission setup happens only once per browsing session

## 🏗️ Development

### Project Structure
```
src/
├── components/
│   ├── common/          # Reusable UI components
│   ├── alphabet/        # Alphabet learning game
│   └── math/           # Mathematics game
├── utils/
│   ├── audio.ts        # Audio management
│   └── difficulty.ts   # Difficulty system
└── assets/             # Images and sounds
```

### Available Scripts (PowerShell)
```powershell
npm run dev      # Start development server
npm run build    # Build for production  
npm run preview  # Preview production build
npm run lint     # Run ESLint

# PowerShell-specific utilities
Get-Process -Name "node" | Stop-Process -Force  # Stop all Node.js processes
Remove-Item -Recurse -Force node_modules, dist  # Clean project
```

## 🚀 Deployment

This project uses **manual-only deployments** for full control over when updates go live.

### Quick Deploy to Production:
```powershell
# Use the deployment script (recommended)
.\deploy-production.ps1

# Or manual commands
npm run build && npx vercel --prod
```

### Production URL:
**https://preschool-learning-app.vercel.app/**

For detailed deployment instructions, see [MANUAL_DEPLOYMENT.md](./MANUAL_DEPLOYMENT.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🎉 Acknowledgments

- Designed with love for Danish children learning their first letters and numbers
- Built with modern web technologies for the best learning experience
- Optimized for touch devices and kid-friendly interaction