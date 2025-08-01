// Re-export the new AudioController for backward compatibility
// This allows existing components to continue using `import { audioManager } from '../utils/audio'`
// while they're being migrated to the new useAudio() hook

export { 
  audioController as audioManager, 
  setGlobalAudioPermissionContext,
  getGlobalAudioPermissionContext,
  AudioController 
} from './AudioController'

// Re-export the AudioController instance as the default export for compatibility
import { audioController } from './AudioController'
export default audioController