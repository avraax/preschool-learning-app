# 🎈 Børnelæring - Danish Preschool Learning App

A fun and interactive web application designed to teach Danish children aged 3-7 years the alphabet, basic reading skills, and mathematics.

## 🌟 Features

### 📚 Learning Modules
- **Alphabet Learning**: Interactive letter recognition from A to Å
- **Mathematics**: Counting from 1-100 and basic arithmetic operations
- **Difficulty Levels**: Age-appropriate content for 3-4, 4-6, and 6-7 year olds

### 🎵 Audio Features
- **Danish Text-to-Speech**: Native Danish pronunciation for all content
- **Interactive Audio**: Letters, numbers, and instructions read aloud
- **Encouraging Feedback**: Positive reinforcement in Danish

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
- **Audio**: Web Speech API + Howler.js
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

## 🔊 Audio Requirements

The app uses the Web Speech API for Danish text-to-speech. For the best experience:
- Use a modern browser with speech synthesis support
- Ensure your device/browser has Danish language support
- Allow audio permissions when prompted

## 🎮 How to Use

1. **Choose Difficulty**: Select the appropriate age level
2. **Pick a Module**: Choose between Alphabet or Math
3. **Listen & Learn**: Click the audio button to hear instructions
4. **Interactive Play**: Tap/click on answers to play and learn
5. **Progress**: Track your score as you learn

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