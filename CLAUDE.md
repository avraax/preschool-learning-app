# 🎈 Børnelæring - Danish Preschool Learning App

## 📋 Project Overview

This is a comprehensive web application designed to teach Danish children aged 3-7 years the alphabet and basic mathematics through interactive games. The app features native Danish audio narration, kid-friendly animations, and adaptive difficulty levels.

## 🎯 Project Purpose & Goals

### Primary Purpose
Create an engaging educational web app that helps Danish preschool children learn:
- **Alphabet Recognition**: All Danish letters from A to Å
- **Basic Mathematics**: Counting 1-100, addition, and subtraction
- **Audio Learning**: Everything narrated in clear Danish

### Key Requirements Implemented
- ✅ **Target Age Group**: 3-7 years old
- ✅ **Language**: All content in Danish (text + audio)
- ✅ **Platform**: Web app (deployable to any URL)
- ✅ **Device Support**: Tablets, phones, iPads, computers
- ✅ **Audio**: Danish text-to-speech for all content
- ✅ **Visual Design**: Colorful, animated, kid-friendly interface
- ✅ **Educational Content**: Playful learning with animals, colors, sounds
- ✅ **Difficulty Levels**: Age-appropriate content adaptation

## 🏗️ Technical Architecture

### Technology Stack
```
Frontend Framework: React 18 + TypeScript
Build Tool: Vite
Styling: Tailwind CSS v4 + Custom CSS
Animations: Framer Motion
Audio: Web Speech API + Howler.js
Deployment: Vercel-ready configuration
```

### Project Structure
```
preschool-learning-app/
├── src/
│   ├── components/
│   │   ├── common/           # Reusable UI components
│   │   │   ├── Button.tsx    # Animated button component
│   │   │   └── Card.tsx      # Container card component
│   │   ├── alphabet/
│   │   │   └── AlphabetGame.tsx  # Letter recognition game
│   │   └── math/
│   │       └── MathGame.tsx      # Counting & arithmetic game
│   ├── utils/
│   │   ├── audio.ts         # Danish audio management system
│   │   └── difficulty.ts    # Age-based difficulty system
│   ├── App.tsx              # Main application router
│   ├── main.tsx            # React entry point
│   └── index.css           # Global styles + Tailwind
├── public/                  # Static assets
├── package.json            # Dependencies & scripts
├── tailwind.config.js      # Tailwind configuration
├── postcss.config.js       # PostCSS configuration
├── vite.config.ts          # Vite build configuration
├── vercel.json             # Vercel deployment config
└── README.md               # User documentation
```

## 🎮 Features & Functionality

### Core Learning Modules

#### 1. Alphabet Game (`/src/components/alphabet/AlphabetGame.tsx`)
- **Purpose**: Teach letter recognition A-Å
- **Gameplay**: Audio prompt → visual options → click correct letter
- **Features**:
  - Danish pronunciation for each letter
  - Visual letter display with large, kid-friendly fonts
  - 4-option multiple choice interface
  - Score tracking
  - Adaptive letter sets based on difficulty level

#### 2. Math Game (`/src/components/math/MathGame.tsx`)
- **Purpose**: Teach counting and basic arithmetic
- **Two Modes**:
  - **Counting Mode**: Number recognition 1-100
  - **Arithmetic Mode**: Addition/subtraction with visual aids
- **Features**:
  - Danish number pronunciation (including special cases)
  - Visual finger counting animations
  - Progressive difficulty
  - Audio math problem narration

### 3. Difficulty System (`/src/utils/difficulty.ts`)
- **Beginner (3-4 years)**: Letters A-J, counting 1-10
- **Intermediate (4-6 years)**: Letters A-T, counting 1-50, simple addition
- **Advanced (6-7 years)**: Full alphabet A-Å, counting 1-100, addition/subtraction

### 4. Audio System (`/src/utils/audio.ts`)
- **Danish Text-to-Speech**: Web Speech API with Danish locale
- **Number Pronunciation**: Handles Danish number complexities
  - Basic numbers: en, to, tre, fire...
  - Special cases: halvtreds, halvfjerds, halvfems
  - Compound numbers: femogtyve, seksoghalvfjerds
- **Feedback System**: Encouragement and success sounds in Danish

## 🎨 Design Specifications

### Visual Design Principles
- **Color Palette**: Bright, cheerful gradients
  - Purple theme for alphabet
  - Blue theme for mathematics
  - Green theme for settings
- **Typography**: Comic Sans MS for child-friendly readability
- **Animations**: Smooth, playful motions using Framer Motion
- **Icons**: Large emoji and symbols for visual appeal

### Responsive Design
- **Mobile-first**: Optimized for touch devices
- **Large Touch Targets**: Minimum 44px for small fingers
- **Flexible Layouts**: CSS Grid and Flexbox
- **Breakpoints**: 
  - Mobile: < 640px
  - Tablet: 641px - 1024px
  - Desktop: > 1024px

## 🔧 Development Instructions

### Getting Started (PowerShell)
```powershell
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Key Development Commands (PowerShell)
```powershell
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # TypeScript compile + Vite build
npm run lint         # Run ESLint
npm run preview      # Preview production build

# Additional PowerShell-specific commands
Get-Process -Name "node" | Stop-Process -Force  # Stop all Node.js processes
netstat -ano | findstr :5173                    # Check port usage
Remove-Item -Recurse -Force node_modules, dist  # Clean build artifacts
```

### Environment Setup
- **Operating System**: Windows (PowerShell commands)
- **Node.js**: 16+ required
- **Package Manager**: npm (configured for npm workspaces)
- **Terminal**: PowerShell (recommended) or Windows Terminal
- **Browser**: Modern browser with Web Speech API support

## 🚀 Deployment Instructions

### Vercel Deployment (Recommended)
1. **GitHub Setup (PowerShell)**:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Vercel Connection**:
   - Connect GitHub repo to Vercel
   - Vercel auto-detects Vite framework
   - Uses `vercel.json` configuration
   - Deploys automatically on push

3. **Configuration**: Pre-configured in `vercel.json`
   - Build command: `npm run build`
   - Output directory: `dist`
   - SPA routing support

### Alternative Deployment Options
- **Netlify**: Build with `npm run build`, then drag & drop `dist/` folder
- **GitHub Pages**: Use `vite-plugin-gh-pages`
- **Firebase Hosting**: `firebase deploy`
- **Local Testing**: `npm run preview` (PowerShell)

## 🔍 Code Architecture Details

### State Management
- **Local State**: React useState for component state
- **Persistence**: localStorage for difficulty settings
- **No Global State**: Simple prop drilling sufficient for app size

### Audio Architecture
- **Primary**: Web Speech API for Danish TTS
- **Fallback**: Howler.js for custom audio files
- **Language**: Danish (da-DK locale)
- **Voice Selection**: Automatic Danish voice detection

### Animation System
- **Library**: Framer Motion
- **Patterns**: 
  - Entry animations (fade in, scale up)
  - Hover effects (scale, shadow changes)
  - Continuous animations (floating, rotating)
  - Page transitions

### Type Safety
- **TypeScript**: Strict mode enabled
- **Custom Types**: Defined for difficulty levels, game states
- **Component Props**: Fully typed interfaces

## 🐛 Troubleshooting & Common Issues

### Audio Issues
- **Danish Voice Not Available**: App falls back to system default
- **Audio Permissions**: Browser may require user interaction first
- **iOS Safari**: May require specific user gesture for audio

### Build Issues
- **Tailwind CSS v4**: Uses new `@tailwindcss/postcss` plugin
- **PostCSS Configuration**: Must use new plugin format
- **TypeScript Errors**: All imports properly typed

### Performance Considerations
- **Bundle Size**: ~308KB (gzipped: ~97KB)
- **Lazy Loading**: Components not lazy-loaded (small app)
- **Audio Caching**: Speech synthesis cached by browser

## 📝 Future Enhancement Ideas

### Potential Features
- **Letter Tracing**: Canvas-based writing practice
- **More Game Types**: Memory games, puzzles
- **Progress Tracking**: Parent dashboard
- **Custom Audio**: Professional Danish voice recordings
- **Offline Mode**: Service worker for offline play
- **More Subjects**: Colors, shapes, animals

### Technical Improvements
- **PWA Features**: Install prompt, offline support
- **Analytics**: Usage tracking for improvement
- **A/B Testing**: Difficulty level optimization
- **Accessibility**: Screen reader support, high contrast mode

## 📚 Learning Resources

### Danish Language Resources
- **Numbers**: Complete Danish counting system implemented
- **Alphabet**: Full Danish alphabet including Æ, Ø, Å
- **Pronunciation**: Web Speech API with Danish locale

### Educational Theory Applied
- **Age-Appropriate Content**: Based on Danish preschool curriculum
- **Progressive Difficulty**: Scaffolded learning approach
- **Positive Reinforcement**: Encouraging feedback system
- **Multi-Sensory Learning**: Visual, auditory, and tactile elements

## 🤝 Collaboration Notes

### Code Style
- **Formatting**: Prettier (implicit via Vite)
- **Linting**: ESLint with React rules
- **Naming**: camelCase for variables, PascalCase for components
- **File Structure**: Feature-based organization

### Git Workflow (PowerShell)
```powershell
# Feature branch workflow
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# Clean up and restart development
Get-Process -Name "node" | Stop-Process -Force
Remove-Item -Recurse -Force node_modules, dist
npm install
npm run dev
```

### PowerShell-Specific Notes
- **Process Management**: Use `Get-Process` and `Stop-Process` for Node.js cleanup
- **File Operations**: `Remove-Item -Recurse -Force` for cleaning directories
- **Port Checking**: `netstat -ano | findstr :PORT` to check port usage
- **Task Killing**: Use PID from netstat with `Stop-Process -Id <PID> -Force`

This documentation provides everything needed to understand, develop, and deploy the Danish preschool learning app using PowerShell on Windows. The codebase is ready for collaborative development and future enhancements.