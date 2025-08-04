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
Build Tool: Vite 5.2.0
UI Framework: Material-UI v7 (complete design system)
Styling: Material-UI System + CSS (no Tailwind)
Animations: Framer Motion 12.23.6
Audio: AudioController + AudioPermissionContext + Google TTS + Web Speech API + Howler.js
Routing: React Router DOM v7.7.1
PWA: Vite PWA Plugin
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
│   ├── /math/addition (Addition practice)
│   └── /math/comparison (Number comparison game)
├── /farver (Colors selection page)
│   ├── /farver/jagt (Farvejagt - Color Hunt game)
│   └── /farver/ram-farven (Ram Farven - Color Mixing game)
├── /memory (Memory card game)
├── /demo (Demo games showcase)
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

### 🔊 Centralized Audio System Architecture

The app features a **sophisticated 3-tier audio management system** providing seamless Danish audio narration with automatic permission handling, audio queueing, and cross-platform compatibility.

#### System Architecture

**Core Components:**
- **AudioController** (`src/utils/AudioController.ts`) - Central audio queue and playback management
- **AudioContext** (`src/contexts/AudioContext.tsx`) - Global permission state and React context
- **GlobalAudioPermission** (`src/components/common/GlobalAudioPermission.tsx`) - Beautiful permission modal
- **useAudio Hook** (`src/hooks/useAudio.ts`) - Component-level audio interface
- **entryAudioManager** (`src/utils/entryAudioManager.ts`) - Game entry audio coordination

```typescript
// Current architecture (fixed Promise-based completion)
AudioController          // Central queue system with Promise-based completion
├── AudioContext         // Global permission state management  
├── useAudio()          // Component hook for audio operations
├── GlobalAudioPermission // Session-based permission modal
└── entryAudioManager   // Entry audio coordination with completion tracking
```

#### ⚠️ CRITICAL: All Audio Work Must Use Centralized System

**🔧 For complex audio debugging issues, see [AUDIO_DEBUG_ITERATIVE_WORKFLOW.md](./AUDIO_DEBUG_ITERATIVE_WORKFLOW.md) for the proven production debugging methodology using log analysis and iterative fixes.**

**MANDATORY REQUIREMENTS for all audio-related development:**

1. **❌ NEVER create new audio management code outside the centralized system**
2. **❌ NEVER use Web Speech API, Howler.js, or HTML5 Audio directly in components**
3. **❌ NEVER create component-level audio state or isPlaying states**
4. **❌ NEVER bypass the AudioController queue system**
5. **✅ ALWAYS use `useAudio()` hook in components**
6. **✅ ALWAYS add new specialized audio functions to AudioController class**
7. **✅ ALWAYS use the centralized queue for all audio playback**

#### Centralized AudioController System

**Location**: `src/utils/AudioController.ts`

The AudioController is a singleton class that manages all audio in the application:

```typescript
// CORRECT: Use centralized audio system
import { useAudio } from '../../hooks/useAudio'

const MyGameComponent = () => {
  const audio = useAudio({ componentId: 'MyGame' })
  
  const playSound = async () => {
    // All audio goes through centralized queue
    await audio.speak('Hej børn!')
    await audio.speakNumber(5)
    await audio.playSuccessSound()
  }
}
```

**Key Features:**
- **Queue Management**: Only one audio plays at a time, automatic cancellation
- **Danish Language Support**: Specialized functions for Danish numbers, letters, phrases
- **Permission Integration**: Automatic permission checking and user interaction tracking  
- **Error Handling**: Graceful fallbacks and navigation interruption handling
- **State Management**: Centralized isPlaying state across all components
- **Cross-Platform**: iOS Safari optimization and desktop browser support
- **Universal Navigation Cleanup**: Automatic audio cancellation on all navigation types

#### Migration Guidelines

**If you find audio code that doesn't use the centralized system:**

```typescript
// ❌ OLD PATTERN - Replace immediately
const [isPlaying, setIsPlaying] = useState(false)
const handleSpeak = () => {
  // Direct Web Speech API or other audio libraries
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

// ✅ NEW PATTERN - Use centralized system
const audio = useAudio({ componentId: 'ComponentName' })
const handleSpeak = async () => {
  await audio.speak(text)  // Automatically queued and managed
}
```

#### Smart Permission Detection

**Key Features:**
- **Session-Based**: Permission prompt shows only once per user session
- **Smart Triggers**: Detects app startup, focus changes, and navigation events
- **Proactive Testing**: Tests audio capability before attempting playback
- **Non-Intrusive**: Only appears when audio is actually needed, not after errors

**Trigger Events:**
```typescript
// Automatic detection of user engagement
- App startup and initial load
- Window focus/visibility changes  
- Navigation between game sections
- Switching back from other apps
- User interactions (clicks, touches)
```

#### Permission State Management

```typescript
interface AudioPermissionState {
  hasPermission: boolean      // Current permission status
  needsPermission: boolean    // Whether app currently needs audio
  showPrompt: boolean         // Whether to display permission modal
  sessionInitialized: boolean // Session state tracking
  lastUserInteraction: number // Timestamp for iOS compatibility
}
```

#### Beautiful User Interface

The permission modal features:
- **Elegant Design**: Purple gradient background with smooth animations
- **Danish Language**: Clear, child-friendly instructions
- **Visual Appeal**: Volume icon animations and modern styling
- **Dismissible**: Users can close or enable audio permissions
- **Responsive**: Works on all device sizes and orientations

#### AudioController Integration

**Location**: `src/utils/AudioController.ts`

The centralized AudioController automatically handles:
```typescript
// Promise-based audio queueing with completion tracking
async queueAudio(
  audioFunction: () => Promise<void>, 
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const queueItem: AudioQueueItem = {
      audioFunction: async () => {
        try {
          await audioFunction()
          resolve(audioId) // Resolves when audio actually completes
        } catch (error) {
          reject(error)
        }
      }
    }
  })
}
```

#### Cross-Platform Compatibility

**iOS Safari Optimization:**
- Enhanced interaction tracking for iOS audio restrictions
- Silent audio testing to verify permissions
- Fallback to Web Speech API when needed
- Respects iOS 10-second interaction timeout

**Desktop Browsers:**
- More permissive permission handling
- Automatic permission detection
- Seamless audio experience

#### Developer Guidelines

**Usage in Components:**
```typescript
// ✅ CORRECT: Use centralized audio system
import { useAudio } from '../../hooks/useAudio'

const MyComponent = () => {
  const audio = useAudio({ componentId: 'MyComponent' })
  
  const handleAction = async () => {
    // All audio automatically queued and managed
    await audio.speak('Hej børn!')
    await audio.speakNumber(5)
    await audio.playSuccessSound()
  }
  
  return <button onClick={handleAction}>Play Audio</button>
}
```

**❌ DEPRECATED: Direct audioManager import**
```typescript
// ❌ OLD PATTERN - Do not use in new code
import { audioManager } from '../../utils/audio'
await audioManager.speak('text') // Bypasses React context and state management
```

**No Manual Permission Handling Required:**
- ❌ No need for component-level permission state
- ❌ No need for try/catch audio permission blocks  
- ❌ No need for individual iOS prompts
- ❌ No need for manual isPlaying state management
- ✅ Centralized system handles everything automatically

#### Adding New Audio Functions

**When you need new specialized audio functionality:**

1. **Add to AudioController class** in `src/utils/AudioController.ts`:
```typescript
// ✅ CORRECT: Add specialized functions to AudioController
async speakMyNewFunction(customText: string): Promise<string> {
  return this.queueAudio(async () => {
    this.updateUserInteraction()
    
    const hasPermission = await this.checkAudioPermission()
    if (!hasPermission) return
    
    // Your specialized audio logic here
    await this.googleTTS.synthesizeAndPlay(customText, 'primary', true)
  })
}
```

2. **Export through useAudio hook** in `src/hooks/useAudio.ts`:
```typescript
// Add to hook interface
speakMyNewFunction: (text: string) => Promise<string>
```

3. **Use in components**:
```typescript
const audio = useAudio({ componentId: 'MyComponent' })
await audio.speakMyNewFunction('Custom text')
```

#### Universal Navigation Audio Cleanup

**Automatic Audio Cancellation on Navigation:**

The centralized system automatically cancels all ongoing audio when any navigation occurs, ensuring a clean user experience without audio bleeding between routes.

**Supported Navigation Types:**
- **Browser Navigation**: Back/forward buttons, page refresh, tab close
- **React Router Navigation**: All programmatic navigation and route changes
- **Direct URL Changes**: Bookmarks, typed URLs, deep links
- **Component Navigation**: Navigate() calls, Link clicks, redirect components

**Implementation Details:**

1. **Browser Event Detection** (AudioController.ts):
```typescript
// Automatic cleanup on browser navigation
window.addEventListener('beforeunload', cleanup)  // Page close/refresh
window.addEventListener('pagehide', cleanup)      // Page hide
window.addEventListener('popstate', cleanup)      // Back/forward buttons
```

2. **React Router Detection** (App.tsx):
```typescript
// NavigationAudioCleanup component detects route changes
const NavigationAudioCleanup = () => {
  const location = useLocation()
  const audioContext = useAudioContext()
  
  useEffect(() => {
    audioContext.triggerNavigationCleanup()  // Cancel audio on route change
  }, [location.pathname])
}
```

3. **Centralized Cleanup System** (AudioController.ts):
```typescript
// Extensible navigation callback system
public registerNavigationCleanup(callback: () => void): () => void
public triggerNavigationCleanup(): void  // Called by React Router detection
```

**Benefits:**
- **No Component Changes**: Existing games work without modification
- **Universal Coverage**: All navigation types trigger audio cleanup
- **Immediate Response**: Audio stops before new route renders
- **Centralized Logic**: Single system handles all cleanup scenarios
- **Extensible**: Components can register additional cleanup callbacks

#### Audio Technology Stack

**Primary: Google Cloud TTS**
- High-quality Danish Wavenet voices
- Custom SSML for child-friendly speech patterns
- Intelligent caching system
- Server-side synthesis via `/api/tts`

**Fallback: Web Speech API**
- Browser-native Danish voices
- Client-side synthesis
- Automatic fallback when Google TTS unavailable

**Sound Effects: Howler.js**
- Game sound effects and music
- Cross-browser audio compatibility
- Volume and playback controls

#### Performance Optimizations

**Caching Strategy:**
- 24-hour audio cache in localStorage
- Preloading of common phrases and numbers
- Batch synthesis for better performance
- Cache size limits (100 items max)

**Network Optimization:**
- Serverless TTS API functions
- Compressed audio delivery
- Graceful degradation on network issues

#### Error Handling & Logging

**Comprehensive Error Tracking:**
```typescript
// Detailed logging for debugging
logAudioIssue('Audio event', error, {
  isIOS: deviceInfo.isIOS,
  permissionState: context.state,
  audioContextState: this.audioContext?.state,
  userAgent: navigator.userAgent
})
```

**Graceful Degradation:**
- Silent fallback when audio unavailable
- Non-blocking game functionality
- User-friendly error recovery

#### Key Improvements Over Legacy System

**Centralized Architecture Benefits:**
- ✅ **Single Audio Queue**: Only one audio plays at a time with automatic cancellation
- ✅ **Promise-Based Completion**: Fixed entry audio cutoff issues with proper async/await
- ✅ **Global Permission Management**: Session-based permission modal replaces scattered prompts
- ✅ **Navigation Cleanup**: Automatic audio cancellation on route changes
- ✅ **Cross-Platform Optimization**: Enhanced iOS Safari compatibility

**Developer Experience:**
- 🎯 **Simple Component Usage**: `const audio = useAudio({ componentId: 'GameName' })`
- 🎯 **Automatic Permission Handling**: No manual permission checks needed
- 🎯 **Queue Management**: `await audio.speak()` ensures proper sequencing
- 🎯 **Error Recovery**: Graceful fallbacks and comprehensive logging

### Project Structure
```
preschool-learning-app/
├── src/
│   ├── components/
│   │   ├── common/           # Shared UI components
│   │   │   ├── GlobalAudioPermission.tsx  # Global audio permission modal
│   │   │   ├── LearningGrid.tsx  # Responsive grid layout
│   │   │   ├── Logo.tsx      # App logo components
│   │   │   ├── RepeatButton.tsx  # Centralized repeat button variants
│   │   │   └── balloon/      # Balloon effects components
│   │   ├── alphabet/         # Alphabet learning games
│   │   │   ├── AlphabetGame.tsx     # Letter recognition quiz
│   │   │   ├── AlphabetLearning.tsx # Interactive letter learning
│   │   │   └── AlphabetSelection.tsx # Alphabet section menu
│   │   ├── math/             # Math learning games
│   │   │   ├── MathGame.tsx         # Counting game
│   │   │   ├── MathSelection.tsx    # Math section menu
│   │   │   ├── NumberLearning.tsx   # Interactive number learning
│   │   │   ├── AdditionGame.tsx     # Addition practice
│   │   │   └── ComparisonGame.tsx   # Number comparison game
│   │   ├── farver/           # Color learning games
│   │   │   ├── FarverSelection.tsx  # Colors section menu
│   │   │   ├── FarvejagtGame.tsx    # Color Hunt game
│   │   │   └── RamFarvenGame.tsx    # Color Mixing game
│   │   ├── learning/         # Additional learning games
│   │   │   └── MemoryGame.tsx       # Memory card game
│   │   ├── demo/             # Demo games showcase
│   │   │   ├── DemoPage.tsx         # Demo section landing
│   │   │   └── games/               # Individual demo games
│   │   └── admin/            # Admin tools
│   │       └── ErrorDashboard.tsx   # Error monitoring
│   ├── contexts/
│   │   └── AudioContext.tsx            # Global audio permission state and React context
│   ├── hooks/
│   │   └── useAudio.ts                 # Component-level audio hook interface
│   ├── utils/
│   │   ├── AudioController.ts          # Central audio queue and playback management
│   │   ├── urlParams.ts     # URL parameter utilities
│   │   ├── deviceDetection.ts # Device capability detection
│   │   └── remoteConsole.ts # Remote error logging
│   ├── services/
│   │   └── googleTTS.ts     # Google Cloud TTS integration
│   ├── config/
│   │   ├── categoryThemes.ts # Centralized theme configuration
│   │   └── version.ts       # App version management
│   ├── App.tsx              # Main application router with AudioProvider and NavigationAudioCleanup
│   ├── main.tsx            # React entry point
│   └── index.css           # Global styles
├── public/                  # Static assets
├── package.json            # Dependencies & scripts
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

#### 2. Math Games
- **Counting Game** (`/src/components/math/MathGame.tsx`)
  - Number recognition 1-50
  - Danish number pronunciation
  - Visual finger counting animations
- **Number Learning** (`/src/components/math/NumberLearning.tsx`)
  - Interactive number exploration
  - Visual representations of quantities
  - Touch-based learning
- **Addition Game** (`/src/components/math/AdditionGame.tsx`)
  - Addition problems up to 10+10=20
  - Visual aids for calculation
  - Progressive difficulty
- **Comparison Game** (`/src/components/math/ComparisonGame.tsx`)
  - Greater than/less than concepts
  - Visual comparison exercises
  - Number size relationships

#### 3. Color Games (`Farver`)
- **Farvejagt (Color Hunt)** (`/src/components/farver/FarvejagtGame.tsx`)
  - Find objects by color
  - Rich database of everyday objects
  - Progressive difficulty levels
  - Visual and audio feedback
- **Ram Farven (Hit the Color)** (`/src/components/farver/RamFarvenGame.tsx`)
  - Interactive color mixing
  - Primary and secondary colors
  - Target color matching
  - Creative exploration mode

#### 4. Memory Game (`/src/components/learning/MemoryGame.tsx`)
- **Purpose**: Enhance memory and pattern recognition
- **Features**:
  - Card matching gameplay
  - Progressive difficulty
  - Visual memory training
  - Celebration animations

### 5. Comprehensive Game Settings
- **Full Complexity**: Suitable for all children aged 3-7 years
- **Alphabet**: Complete Danish alphabet A-Å (including æ, ø, å)
- **Math**: Numbers 1-50 for counting, addition problems up to 10+10=20
- **Colors**: Full spectrum learning with mixing and identification
- **Memory**: Pattern recognition and recall exercises

### 6. Advanced Audio System
- **Global Permission Management**: Smart, session-based audio permission handling
- **Multi-Tier Audio Stack**: Google Cloud TTS → Web Speech API → Howler.js fallbacks
- **Danish Text-to-Speech**: High-quality Wavenet voices with child-friendly speech patterns
- **Number Pronunciation**: Handles Danish number complexities
  - Basic numbers: en, to, tre, fire...
  - Special cases: halvtreds, halvfjerds, halvfems
  - Compound numbers: femogtyve, seksoghalvfjerds
- **Intelligent Caching**: 24-hour localStorage cache with automatic cleanup
- **Cross-Platform Optimization**: iOS Safari compatibility with enhanced interaction tracking
- **Beautiful Permission UI**: Elegant purple gradient modal with Danish instructions
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

### Audio Development Guidelines

**⚠️ BEFORE making any audio-related changes:**

1. **Read the Centralized Audio System Architecture section above**
2. **Never create audio code outside the centralized system**
3. **Always use `useAudio()` hook in components**
4. **Add new audio functions to AudioController class only**

**Audio Development Workflow:**
```powershell
# 1. Check existing audio functions in AudioController
Get-Content src/utils/AudioController.ts | Select-String "async.*Promise<string>"

# 2. Add new functions to AudioController class if needed
# 3. Export through useAudio hook interface
# 4. Test with centralized queue system
npm run dev

# 5. Verify no audio conflicts or bypassing
# Check console for 🎵 AudioController logs
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
- **Primary**: Google Cloud TTS for high-quality Danish synthesis
- **Fallback**: Web Speech API for browser-native voices
- **Sound Effects**: Howler.js for game audio
- **Language**: Danish (da-DK locale) with specialized number pronunciation
- **Queue Management**: AudioController ensures single audio playback

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

### Audio Issues - Use Centralized System Only

**⚠️ CRITICAL: All audio issues must be fixed in the centralized AudioController system.**

- **Audio Not Playing**: Check AudioController queue system, not component-level audio
- **Multiple Audio Playing**: Indicates bypass of centralized queue - fix by using useAudio() hook
- **Permission Issues**: Handled automatically by AudioController - no component-level fixes needed
- **Danish Voice Not Available**: AudioController automatically falls back to system default
- **iOS Safari Audio**: AudioController handles iOS-specific audio restrictions automatically
- **Entry Audio Cut Off**: Fixed globally in AudioController.queueAudio() - no per-game fixes needed

**Debugging Audio Issues:**
1. Check AudioController console logs (prefixed with 🎵)
2. Use `audioController.getTTSStatus()` for queue and cache information
3. Verify component uses `useAudio()` hook, not direct audioManager imports
4. Ensure no bypassing of the centralized queue system
5. Look for navigation cleanup logs: "Navigation detected, cleaning up all audio"
6. Verify NavigationAudioCleanup component is active in App.tsx

### Build Issues
- **Material-UI v7**: Uses latest design system with enhanced theming
- **Vite Configuration**: Optimized for fast development and production builds
- **TypeScript Errors**: All imports properly typed with strict mode

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

## 🎨 Centralized Category Theming System

### Overview
The app uses a centralized theming system to ensure consistent visual design across all learning categories. This system provides unified color schemes, gradients, and styling for each major section.

### Theme Configuration
**Location**: `src/config/categoryThemes.ts`

Each category has a comprehensive theme definition:
```typescript
interface CategoryTheme {
  id: string                // Unique identifier
  name: string              // Danish display name
  gradient: string          // Background gradient
  accentColor: string       // Primary accent color
  borderColor: string       // Default border color
  hoverBorderColor: string  // Hover state border
  icon: string              // Category emoji icon
  iconSize: string          // Icon display size
  description: string       // Danish description
}
```

### Current Categories
1. **Alphabet (alfabetet)**
   - Blue gradient theme
   - Academic, learning-focused design
   - Icon: 📚

2. **Math (tal og regning)**
   - Purple gradient theme
   - Playful, calculation-focused design
   - Icon: 🧮

3. **Colors (farver)**
   - Orange/yellow gradient theme
   - Creative, artistic design
   - Icon: 🎨

### Usage in Components
```typescript
import { getCategoryTheme } from '../config/categoryThemes'

// Get theme for a category
const theme = getCategoryTheme('alphabet')

// Apply theme to component
<Box sx={{ 
  background: theme.gradient,
  borderColor: theme.borderColor
}}>
```

### Benefits
- **Consistency**: All games in a category share visual identity
- **Maintainability**: Single source of truth for theming
- **Extensibility**: Easy to add new categories
- **Accessibility**: Carefully chosen color contrasts

## Configuration Best Practices

### Code Reuse and DRY Principle
- **ALWAYS** reuse code and configurations to avoid duplication
- Create shared configuration files for settings used in multiple places
- Check for existing patterns before creating new files

### Current Shared Configurations
- **AudioController** - Centralized audio settings and queue management
- **categoryThemes.ts** - Unified color schemes and styling for game categories
- **version.ts** - Build information and version tracking
- **Google TTS Configuration** - Danish Wavenet voice with child-friendly speech patterns

### Development Guidelines
- When updating settings, always check if they're used elsewhere
- Prefer modifying shared configs over duplicating values
- Use environment variables for deployment-specific settings
- Document any new shared configurations here

## 🎮 Game Development Guidelines

### Current Game Architecture

**All games successfully use the centralized audio system with these patterns:**

#### Task-Based Games (Quiz/Problem Games):
- AlphabetGame, MathGame, AdditionGame, ComparisonGame, MemoryGame
- Use `entryAudioManager.onComplete()` for entry audio coordination
- Show full UI immediately with conditional content rendering
- Material-UI components for consistent styling

#### Learning-Based Games (Exploration Games):
- AlphabetLearning, NumberLearning, FarvejagtGame, RamFarvenGame
- Direct audio interaction with immediate feedback
- No entry audio coordination needed

#### Demo Games (Prototype Games):
- 11 demo games in `/demo/games/` directory
- All migrated to use centralized `useAudio()` hook
- Showcase various interaction patterns and game mechanics

### Required Implementation Pattern

#### 1. Import Centralized Components
```typescript
import { useTaskBasedGame } from '../../hooks/useTaskBasedGame'
import { MathRepeatButton, AlphabetRepeatButton } from '../common/RepeatButton'
```

#### 2. Use Centralized Hook
```typescript
const { entryAudioComplete } = useTaskBasedGame({
  gameType: 'addition', // Must match useGameEntryAudio gameType
  onEntryAudioComplete: () => generateNewProblem(),
  delay: 500 // Optional, defaults to 500ms
})
```

#### 3. Use Centralized Repeat Button
```typescript
// For math games
<MathRepeatButton 
  onClick={repeatProblem}
  disabled={!entryAudioComplete || isPlaying}
  label="🎵 Hør igen"
/>

// For alphabet games  
<AlphabetRepeatButton 
  onClick={repeatQuestion}
  disabled={!entryAudioComplete}
/>
```

#### 4. Handle Empty States
```typescript
// Show nothing during entry audio, then show content
{options.length > 0 ? renderOptions() : null}

// Or use utility helpers
import { renderWithEmptyState } from '../../utils/gameStateUtils'
{renderWithEmptyState(options, renderOptions)}
```

### Centralized Components

#### `useTaskBasedGame` Hook
**Location**: `src/hooks/useTaskBasedGame.ts`

**Purpose**: Consolidates entry audio completion handling and state management

**Features**:
- Registers entry audio completion callback automatically
- Manages `entryAudioComplete` state
- Calls `onEntryAudioComplete` after configurable delay
- Eliminates duplicate callback registration code

#### `RepeatButton` Components  
**Location**: `src/components/common/RepeatButton.tsx`

**Purpose**: Provides consistent styling and behavior for repeat buttons

**Variants**:
- `MathRepeatButton` - Purple theme, "Hör igen" label
- `AlphabetRepeatButton` - Blue theme, "Gentag" label  
- `ColorRepeatButton` - Orange theme, "Hør igen" label

#### Game State Utilities
**Location**: `src/utils/gameStateUtils.ts`

**Purpose**: Helper functions for empty state handling and game state management

**Functions**:
- `renderWithEmptyState()` - Conditional rendering helper
- `useGameOptions()` - Hook for managing option arrays
- `useGameProblem()` - Hook for managing current problem state

### Benefits of Centralized Pattern

1. **Consistency**: All task-based games behave identically
2. **DRY Principle**: Eliminates code duplication across 5+ games
3. **Maintainability**: Bug fixes happen in one place
4. **Type Safety**: Centralized interfaces prevent errors
5. **Future-Proof**: New games get correct behavior automatically

### Migration from Old Pattern

#### Before (Duplicate Code):
```typescript
const [entryAudioComplete, setEntryAudioComplete] = useState(false)

entryAudioManager.onComplete('gameType', () => {
  setEntryAudioComplete(true)
  setTimeout(() => generateNewProblem(), 500)
})

<Button disabled={!entryAudioComplete}>Hør igen</Button>
```

#### After (Centralized):
```typescript
const { entryAudioComplete } = useTaskBasedGame({
  gameType: 'addition',
  onEntryAudioComplete: () => generateNewProblem()
})

<MathRepeatButton disabled={!entryAudioComplete} onClick={repeatProblem} />
```

### ⚠️ Critical: No Loading Overlays Pattern

#### Correct Pattern: Show UI Immediately
**Based on working AlphabetGame & MathGame implementations:**

**✅ CORRECT approach - NO loading overlays:**
```typescript
// GOOD: Direct callback registration (like AlphabetGame/MathGame)
const [entryAudioComplete, setEntryAudioComplete] = useState(false)

useEffect(() => {
  entryAudioManager.onComplete('gameType', () => {
    setEntryAudioComplete(true)
    setTimeout(() => generateNewProblem(), 500)
  })
}, [])

// GOOD: Show full UI immediately, no loading states
return (
  <Box>
    <AppBar>{/* Always visible */}</AppBar>
    <Container>
      <Typography>Game Title</Typography>
      
      {/* Disabled repeat button until ready */}
      <Button disabled={!entryAudioComplete}>🎵 Gentag</Button>
      
      {/* Conditional content display */}
      {options.length > 0 ? options.map(...) : null}
    </Container>
  </Box>
)
```

**❌ NEVER do this:**
```typescript
// BAD: Loading overlay (causes unwanted intermediate screen)
if (!entryAudioComplete) {
  return (
    <Box>
      <Typography>Game Title</Typography>
      <Typography>Lytter...</Typography> {/* ❌ Unwanted overlay */}
    </Box>
  )
}

// BAD: useTaskBasedGame hook (over-engineered)
const { entryAudioComplete } = useTaskBasedGame({...}) // ❌ Use direct pattern instead
```

#### Required Implementation Pattern
**Follow exact pattern from AlphabetGame/MathGame:**

1. **Show full UI immediately** - no loading overlays ever
2. **Disabled repeat button** until `entryAudioComplete` 
3. **Conditional content rendering** with `{options.length > 0 ? ... : null}`
4. **Direct callback registration** with `entryAudioManager.onComplete()`
5. **No useTaskBasedGame hook** - use direct pattern instead

### Required for New Task-Based Games

1. **MUST show full UI immediately** - never use loading overlays
2. **MUST use direct callback registration** with `entryAudioManager.onComplete()`
3. **MUST use appropriate `RepeatButton` variant** if game has repeat functionality
4. **MUST disable repeat button** until `entryAudioComplete` is true
5. **MUST use conditional content rendering** with `{content.length > 0 ? ... : null}`
6. **MUST NOT use useTaskBasedGame hook** - use direct pattern instead
7. **MUST NOT create loading screens** or "Lytter..." overlays
8. **MUST follow AlphabetGame/MathGame pattern** exactly

### New Centralized Helper (Optional)
**Location**: `src/hooks/useDirectTaskGame.ts`

For teams who prefer hooks, use the new centralized helper:
```typescript
import { useDirectTaskGame } from '../../hooks/useDirectTaskGame'

const { entryAudioComplete } = useDirectTaskGame({
  gameType: 'addition',
  onEntryAudioComplete: () => generateNewProblem()
})
```

This provides the same direct pattern but with reduced boilerplate code.

## Responsive Layout Guidelines

### Core Principle
**All game layouts MUST fill available screen space without scrolling, maintaining optimal proportions in both portrait and landscape orientations.**

### Layout Requirements

#### 1. Grid Systems
- **Always use CSS Grid** with dynamic sizing instead of fixed dimensions
- Use `gridAutoRows: 'minmax(0, 1fr)'` for equal height distribution
- Implement responsive column counts based on orientation and screen size
- Example pattern from LearningGrid:
```javascript
gridTemplateColumns: {
  xs: 'repeat(6, 1fr)',   // Mobile portrait
  sm: 'repeat(8, 1fr)',   // Tablet
  md: 'repeat(10, 1fr)'   // Desktop
}
```

#### 2. Orientation Support
- **Implement landscape/portrait specific layouts** using media queries
- Adjust grid columns to maintain aspect ratios
- Example:
```javascript
'@media (orientation: landscape)': {
  gridTemplateColumns: 'repeat(10, 1fr)' // More columns in landscape
}
```

#### 3. Dynamic Sizing
- **No fixed heights** - use flex containers and relative units
- Container structure: `height: '100vh'` with flex children
- Cards/items should expand to fill available space
- Use `overflow: 'hidden'` to prevent scrolling

#### 4. Font Sizing
- **Use clamp() for responsive typography**
- Combine viewport units with min/max constraints
- Example: `fontSize: 'clamp(1rem, 3.5vw, 1.5rem)'`
- Adjust font sizes for landscape orientation

#### 5. Touch Targets
- **Maintain minimum 44px touch areas** for accessibility
- Scale up elements on larger screens
- Use padding to increase tap areas without affecting visual size

### Implementation Pattern
```javascript
// Container setup
<Box sx={{ 
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}}>
  // Fixed height header
  <AppBar sx={{ flex: '0 0 auto' }} />
  
  // Flexible content area
  <Container sx={{ 
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  }}>
    // Grid that fills available space
    <Box sx={{
      flex: 1,
      display: 'grid',
      gridAutoRows: 'minmax(0, 1fr)',
      gap: { xs: '8px', md: '12px' }
    }}>
      // Content items
    </Box>
  </Container>
</Box>
```

### Testing Requirements
1. **Test on multiple devices**: phones, tablets, desktop
2. **Test both orientations**: portrait and landscape
3. **Verify no scrolling** unless explicitly required
4. **Check touch targets** are easily tappable
5. **Ensure text remains readable** at all sizes

### Common Pitfalls to Avoid
- ❌ Fixed heights like `height: 200px`
- ❌ Using only breakpoints without orientation queries
- ❌ Small touch targets on mobile
- ❌ Text that becomes too small/large at extremes
- ❌ Layouts that require scrolling to see all content

### Reference Implementation
See `src/components/common/LearningGrid.tsx` for a complete example of these principles in action.

## Aspect Ratio Guidelines

### Core Principle
**All interactive elements MUST maintain natural, readable proportions that enhance usability and visual appeal, avoiding extremely tall, narrow, or wide elements.**

### Element-Specific Standards

#### 1. Quiz Cards (Letters/Numbers)
- **Aspect Ratio**: 4:3 (width:height)
- **Rationale**: Optimal for displaying single characters while maintaining touch accessibility
- **Implementation**: `aspectRatio: '4/3'`
- **Constraints**: `minHeight: '80px'`, `maxHeight: '120px'`

#### 2. Memory Cards
- **Aspect Ratio**: 3:4 (width:height) 
- **Rationale**: Traditional card proportions, familiar and easy to scan
- **Implementation**: `aspectRatio: '3/4'`
- **Constraints**: `minHeight: '60px'`, `maxHeight: '100px'`

#### 3. Action Buttons
- **Aspect Ratio**: 3:2 to 4:3 (width:height)
- **Rationale**: Easy to tap without being too wide, good for text labels
- **Implementation**: `aspectRatio: '3/2'` or `aspectRatio: '4/3'`
- **Constraints**: `minHeight: '44px'` (accessibility requirement)

#### 4. Display Cards (Learning Grid)
- **Aspect Ratio**: 1:1 to 4:3 (width:height)
- **Rationale**: Depends on content - square for balanced display, 4:3 for text-heavy content
- **Implementation**: `aspectRatio: '1/1'` or `aspectRatio: '4/3'`

### Implementation Rules

#### 1. CSS Aspect Ratio Property
```javascript
// Always use CSS aspect-ratio for consistent proportions
'& > *': {
  aspectRatio: '4/3',  // Specify appropriate ratio
  minHeight: '80px',   // Ensure minimum touch target
  maxHeight: '120px'   // Prevent oversizing
}
```

#### 2. Grid Layout Adjustments
```javascript
// Use auto-sizing instead of equal height distribution
gridAutoRows: 'auto',  // Instead of 'minmax(0, 1fr)'

// Let aspect ratios determine card sizes naturally
'& > *': {
  aspectRatio: '4/3',
  width: '100%'  // Fill grid cell width, height determined by aspect ratio
}
```

#### 3. Responsive Constraints
- **Always set min/max height** to prevent extreme sizing on different screens
- **Test aspect ratios** at multiple viewport sizes
- **Adjust grid columns** if aspect ratios cause overflow

### Common Aspect Ratio Issues

#### ❌ Problems to Avoid
- Cards that are extremely tall and narrow (height >> width)
- Cards that are extremely wide and flat (width >> height)  
- Using `gridAutoRows: 'minmax(0, 1fr)'` without aspect ratio constraints
- Fixed heights that break proportions on different screens

#### ✅ Best Practices
- Always define aspect ratios for interactive elements
- Use grid auto-sizing with aspect ratio constraints
- Set reasonable min/max constraints
- Test on multiple device orientations
- Prioritize readability and touch accessibility

### Testing Checklist
1. **Portrait Mode**: Cards maintain good proportions
2. **Landscape Mode**: Cards don't become too wide or narrow  
3. **Small Screens**: Elements remain readable and tappable
4. **Large Screens**: Elements don't become oversized
5. **Touch Targets**: Minimum 44px height maintained
6. **Content Clarity**: Letters/numbers remain clearly visible

### Example Implementation
```javascript
// Quiz game cards with proper aspect ratios
<Box sx={{
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gridAutoRows: 'auto',  // Let aspect ratios determine height
  gap: '16px',
  '& > *': {
    aspectRatio: '4/3',   // Optimal for quiz cards
    minHeight: '80px',    // Minimum touch target
    maxHeight: '120px',   // Prevent oversizing
    width: '100%'
  }
}}>
  {/* Cards will maintain 4:3 proportions */}
</Box>
```