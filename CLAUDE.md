# 🎈 Børnelæring - Danish Preschool Learning App

## 📋 Project Overview

This is a comprehensive web application designed to teach Danish children aged 3-7 years the alphabet and basic mathematics through interactive games. The app features native Danish audio narration, kid-friendly animations, and age-appropriate content.

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
- ✅ **Age-Appropriate**: Fixed settings suitable for 3-7 year olds

## 🏗️ Technical Architecture

### Technology Stack
```
Frontend Framework: React 18 + TypeScript
Build Tool: Vite
Styling: Tailwind CSS v4 + Custom CSS
Animations: Framer Motion
Audio: Web Speech API + Howler.js
Routing: React Router DOM v7
Deployment: Vercel-ready configuration
```

### 🚦 URL Routing Architecture

The app uses **React Router v7** for comprehensive URL-based navigation with full browser history support, bookmarkable URLs, and query parameter state management.

#### Route Structure
```
/ (Home page)
├── /alphabet (Alphabet selection page)
│   ├── /alphabet/learn (Interactive learning)
│   └── /alphabet/quiz (Quiz game)
├── /math (Math selection page)
│   ├── /math/counting (Counting game)
│   ├── /math/numbers (Number learning)
│   └── /math/addition (Addition practice)
└── /admin/errors?level=error&device=ios&limit=50 (Error dashboard)
```

#### Query Parameter Support
- **`level`**: Custom level ranges (e.g., `1-10`, `A-J`)
- **`range`**: Number ranges for math exercises  
- **`limit`**: Result pagination (25, 50, 100, 200)
- **`device`**: Device filtering for admin panel

#### URL Utility Functions
**Location**: `src/utils/urlParams.ts`
```typescript
// Game parameter management
const { getLevel, setLevel, getRange, setRange } = useGameParams()

// Build URLs programmatically
const gameUrl = buildGameUrl('/alphabet/quiz', { 
  level: 'A-M',
  range: '1-20'
})
```

#### Routing Implementation
- **BrowserRouter**: Set up in `main.tsx` for HTML5 history API
- **Routes Configuration**: Centralized in `App.tsx`
- **Navigation**: Uses `useNavigate()` hook instead of callback props
- **State Persistence**: Game settings maintained through URL parameters
- **Deep Linking**: All pages support direct URL access
- **404 Handling**: Custom NotFoundPage component

#### Developer Guidelines
1. **All new features MUST use URL routing** - No component-level state navigation
2. **Query parameters recommended** for user settings (filters, ranges, etc.)
3. **Bookmarkable URLs** - Every unique app state should have a unique URL
4. **Browser history support** - Back/forward buttons must work correctly
5. **Deep linking** - Users should be able to share specific exercise URLs

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
│   │   └── audio.ts         # Danish audio management system
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

### Progressive Web App (PWA) Features
- **Installability**: Users can install the app on their home screen
- **Always Up-to-Date**: Network-only strategy ensures fresh content
- **Custom Icons**: Purple balloon-themed app icons for all platforms
- **Danish Install Prompt**: Native language prompts for better UX
- **Cross-Platform**: Works on iOS, Android, and Desktop browsers
- **No Offline Caching**: Deliberately configured to always fetch latest code

### Core Learning Modules

#### 1. Alphabet Game (`/src/components/alphabet/AlphabetGame.tsx`)
- **Purpose**: Teach letter recognition A-Å
- **Gameplay**: Audio prompt → visual options → click correct letter
- **Features**:
  - Danish pronunciation for each letter
  - Visual letter display with large, kid-friendly fonts
  - 4-option multiple choice interface
  - Score tracking
  - Complete Danish alphabet including Æ, Ø, Å

#### 2. Math Game (`/src/components/math/MathGame.tsx`)
- **Purpose**: Teach counting and basic arithmetic
- **Two Modes**:
  - **Counting Mode**: Number recognition 1-50
  - **Arithmetic Mode**: Addition problems up to 10+10=20
- **Features**:
  - Danish number pronunciation (including special cases)
  - Visual finger counting animations
  - Fixed settings suitable for all ages
  - Audio math problem narration

### 3. Comprehensive Game Settings
- **Full Complexity**: Suitable for all children aged 3-7 years
- **Alphabet**: Complete Danish alphabet A-Å (including æ, ø, å)
- **Math**: Numbers 1-50 for counting, addition problems up to 10+10=20

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

# PWA Testing Commands
node generate-icons.cjs  # Generate app icons from source SVG

# Additional PowerShell-specific commands
Get-Process -Name "node" | Stop-Process -Force  # Stop all Node.js processes
netstat -ano | findstr :5173                    # Check port usage
Remove-Item -Recurse -Force node_modules, dist  # Clean build artifacts
```

### PWA Development Notes
- **Service Worker**: Automatically generated by Vite PWA plugin
- **Testing PWA Features**: Use Chrome DevTools > Application > Manifest
- **Install Prompt**: Test on mobile devices or desktop Chrome
- **Icon Generation**: Custom script creates all platform-specific icons
- **Network-Only Strategy**: No caching ensures always fresh content

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
- **Fixed Settings**: No user-adjustable settings needed
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
- **Custom Types**: Defined for game states, audio management
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
- **A/B Testing**: UI and UX optimization
- **Accessibility**: Screen reader support, high contrast mode

### 🚦 Future Routing Requirements
**All new features MUST follow the established routing architecture:**
- **URL-first design**: Every feature should have dedicated routes
- **Query parameter persistence**: All user settings via URL params
- **Deep linking support**: Direct access to specific game states
- **Shareable URLs**: Parents can bookmark and share specific exercises
- **Browser history**: Proper back/forward navigation support
- **SEO optimization**: Clean, descriptive URLs for future search engine indexing

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

## Configuration Best Practices

### Code Reuse and DRY Principle
- **ALWAYS** reuse code and configurations to avoid duplication
- Create shared configuration files for settings used in multiple places
- Check for existing patterns before creating new files

### Current Shared Configurations
- **`tts-config.js`** - Centralized TTS voice and audio settings
  - Speaking rate: 0.4 (slower for children)
  - Pitch: 1.1 (slightly higher for friendly tone)
  - Voice: da-DK-Wavenet-A (Danish female)
  - Used by both `dev-server.js` and client-side code

### Development Guidelines
- When updating settings, always check if they're used elsewhere
- Prefer modifying shared configs over duplicating values
- Use environment variables for deployment-specific settings
- Document any new shared configurations here