# Audio Debug Workflows - Step-by-Step Protocols

## Quick Diagnosis Flowchart

```
Audio Not Playing?
├── Check Browser Console for 🎵 logs
│   ├── No logs → AudioController not initialized
│   └── Error logs → Check specific error
├── Run audioController.getTTSStatus()
│   ├── Queue empty → Audio not being queued
│   └── Queue stuck → Processing issue
└── Check Permission State
    ├── hasPermission: false → Permission issue
    └── hasPermission: true → Technical issue
```

## Workflow 1: General Audio Not Playing

### Step 1: Initial Console Check
```javascript
// In browser console, run:
audioController.getTTSStatus()
```

**Expected Output:**
```javascript
{
  isPlaying: false,
  queue: [],
  cache: { size: 45, items: [...] },
  googleTTSAvailable: true
}
```

### Step 2: Check Component Implementation
```bash
# Find how component uses audio
grep -n "useAudio\|audio\." [component-file].tsx
```

**Look for:**
- `const audio = useAudio({ componentId: 'Name' })`
- `await audio.speak(...)` calls
- Proper error handling

### Step 3: Test Audio Directly
```javascript
// Force test in console
const audio = window.audioController
await audio.speak('Test lyd')
```

**If fails:** Check error message
**If works:** Component implementation issue

### Step 4: Verify Permission State
```javascript
// Check permission context
const permissionState = JSON.parse(localStorage.getItem('audioPermissionState'))
console.log(permissionState)
```

## Workflow 2: iOS Safari Specific Issues

### Step 1: Verify Device & Browser
```javascript
// Confirm iOS Safari
navigator.userAgent
// Should contain "iPhone" or "iPad" and "Safari"
```

### Step 2: Check Interaction Timing
```javascript
// Check last user interaction
audioController.lastUserInteraction
// Compare with current time
Date.now() - audioController.lastUserInteraction
// Must be < 10000ms (10 seconds)
```

### Step 3: Test Audio Context
```javascript
// Check audio context state
audioController.audioContext?.state
// Should be 'running', not 'suspended'

// If suspended, try resume
await audioController.audioContext?.resume()
```

### Step 4: Force Interaction Test
```javascript
// Add temporary button to test
document.body.insertAdjacentHTML('beforeend', `
  <button onclick="testAudio()" style="position:fixed;top:0;left:0;z-index:9999">
    Test Audio
  </button>
`)

window.testAudio = async () => {
  const result = await audioController.testAudioCapability()
  console.log('Audio test result:', result)
}
```

### Step 5: Check Silent Audio Probe
```javascript
// Verify probe is working
audioController.audioProbe
// Should have an audio element

// Test probe directly
audioController.audioProbe.play()
  .then(() => console.log('Probe works'))
  .catch(e => console.error('Probe failed:', e))
```

## Workflow 3: Permission Modal Not Appearing

### Step 1: Check Session State
```javascript
// Check if session thinks permission already granted
localStorage.getItem('audioPermissionSession')
// If exists, clear it to reset
localStorage.removeItem('audioPermissionSession')
```

### Step 2: Verify Modal Component
```javascript
// Check if GlobalAudioPermission is mounted
document.querySelector('[class*="MuiDialog"]')
// Should find modal if visible
```

### Step 3: Force Permission Check
```javascript
// Manually trigger permission flow
audioController.permissionContext.setState({
  hasPermission: false,
  needsPermission: true,
  showPrompt: true
})
```

### Step 4: Check Console Errors
Look for:
- React mounting errors
- Missing AudioProvider
- State update errors

## Workflow 4: Audio Cuts Off Mid-Speech

### Step 1: Check Navigation Events
```javascript
// Add listener to detect navigation
window.addEventListener('popstate', () => console.log('Navigation detected'))
```

### Step 2: Monitor Queue Processing
```javascript
// Watch queue in real-time
setInterval(() => {
  const status = audioController.getTTSStatus()
  console.log('Queue:', status.queue.length, 'Playing:', status.isPlaying)
}, 1000)
```

### Step 3: Check Component Unmounting
```javascript
// In component, add debug log
useEffect(() => {
  console.log('Component mounted')
  return () => console.log('Component unmounting - audio will stop')
}, [])
```

### Step 4: Test with Longer Audio
```javascript
// Test with long text to see where it cuts
await audioController.speak('Dette er en meget lang tekst der skal hjælpe med at finde ud af hvor lyden bliver afbrudt i afspilningen')
```

## Workflow 5: TTS Synthesis Failures

### Step 1: Check Network Tab
- Open DevTools → Network
- Look for calls to `/api/tts`
- Check status codes (should be 200)
- Verify response has audio data

### Step 2: Test Google TTS Directly
```javascript
// Check if Google TTS is available
audioController.googleTTS.isAvailable()

// Test synthesis
await audioController.googleTTS.synthesizeAndPlay('Test', 'primary')
```

### Step 3: Check API Configuration
```javascript
// Verify API endpoint
console.log('TTS Endpoint:', window.location.origin + '/api/tts')

// Test API directly
fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Test', voiceType: 'primary' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### Step 4: Check Fallback System
```javascript
// Force Web Speech API fallback
audioController.googleTTS.isAvailable = () => false
await audioController.speak('Test med fallback')
```

## Workflow 6: Performance Issues

### Step 1: Profile Audio Queue
```javascript
// Time audio operations
console.time('speak')
await audioController.speak('Test')
console.timeEnd('speak')
```

### Step 2: Check Cache Performance
```javascript
// Get cache statistics
const status = audioController.getTTSStatus()
console.log('Cache size:', status.cache.size)
console.log('Cache hits vs misses')
```

### Step 3: Monitor Memory Usage
```javascript
// Check for memory leaks
if (performance.memory) {
  console.log('Memory:', {
    used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
    total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB'
  })
}
```

### Step 4: Check Queue Buildup
```javascript
// Monitor queue size over time
let maxQueue = 0
setInterval(() => {
  const queueSize = audioController.audioQueue.length
  if (queueSize > maxQueue) {
    maxQueue = queueSize
    console.log('New max queue size:', maxQueue)
  }
}, 100)
```

## Common Error Messages & Solutions

### Error: "The request is not allowed by the user agent"
**Platform:** iOS Safari
**Cause:** No recent user interaction
**Solution:** Ensure audio plays within 10 seconds of user tap

### Error: "DOMException: The play() request was interrupted"
**Platform:** All
**Cause:** Audio cancelled before completion
**Solution:** Check for navigation or component unmounting

### Error: "NotAllowedError: The request is not allowed"
**Platform:** All browsers
**Cause:** No user interaction ever recorded
**Solution:** Require explicit user tap before any audio

### Error: "NetworkError: Failed to fetch"
**Platform:** All
**Cause:** TTS API unreachable
**Solution:** Check network, API endpoint, CORS

### Error: "AudioContext was not allowed to start"
**Platform:** Chrome/Edge
**Cause:** Autoplay policy
**Solution:** Resume context after user interaction

## Platform-Specific Quick Fixes

### iOS Safari
```javascript
// Quick fix for iOS audio context
document.addEventListener('touchstart', async () => {
  if (audioController.audioContext?.state === 'suspended') {
    await audioController.audioContext.resume()
    console.log('Audio context resumed')
  }
}, { once: true })
```

### Android Chrome
```javascript
// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    audioController.audioContext?.resume()
  }
})
```

### Desktop Browsers
```javascript
// Check for browser extensions blocking
if (window.chrome) {
  console.log('Chrome detected - check for ad blockers')
}
```

## Debug Information Collection Script

```javascript
// Run this to collect all debug info
function collectAudioDebugInfo() {
  const info = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    audioController: {
      exists: !!window.audioController,
      status: window.audioController?.getTTSStatus(),
      lastInteraction: window.audioController?.lastUserInteraction,
      contextState: window.audioController?.audioContext?.state
    },
    permission: {
      localStorage: localStorage.getItem('audioPermissionState'),
      session: localStorage.getItem('audioPermissionSession')
    },
    errors: [], // Collect from console
    url: window.location.href
  }
  
  console.log('Debug Info:', JSON.stringify(info, null, 2))
  return info
}

// Copy to clipboard
copy(collectAudioDebugInfo())
```

## Testing Checklist

### Basic Functionality
- [ ] Audio plays on button click
- [ ] Permission modal appears first time
- [ ] Audio continues after permission grant
- [ ] Repeat buttons work
- [ ] Navigation stops audio

### Platform Testing
- [ ] iOS Safari - iPhone
- [ ] iOS Safari - iPad  
- [ ] Android Chrome
- [ ] Desktop Chrome
- [ ] Desktop Safari
- [ ] Desktop Firefox

### Edge Cases
- [ ] Background/foreground transitions
- [ ] Multiple rapid clicks
- [ ] Slow network conditions
- [ ] Clear cache and retry
- [ ] Incognito/Private mode

## When to Escalate

Escalate to senior developer if:
1. Issue persists after all workflows attempted
2. Affects > 10% of users
3. Platform-specific issue with no workaround
4. Potential security concern
5. Requires architecture changes

Document:
- Steps attempted
- Error messages
- Platform/browser details
- Debug info collection
- Minimal reproduction steps