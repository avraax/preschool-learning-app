import { Howl } from 'howler';

export type SoundEffect = 'sharp-pop-328170';

class BalloonSoundManager {
  private sounds: Map<SoundEffect, Howl> = new Map();
  private isLoaded = false;
  private volume = 0.7;

  constructor() {
    this.preloadSounds();
  }

  private preloadSounds() {
    const soundFiles: Record<SoundEffect, string> = {
      'sharp-pop-328170': '/sounds/sharp-pop-328170.mp3'
    };

    Object.entries(soundFiles).forEach(([key, src]) => {
      const sound = new Howl({
        src: [src],
        volume: this.volume,
        preload: true,
        onloaderror: () => {
          console.warn(`Failed to load sound: ${key}`);
        },
        onload: () => {
          // Sound loaded successfully
        }
      });
      
      this.sounds.set(key as SoundEffect, sound);
    });
    
    this.isLoaded = true;
  }

  play(effect: SoundEffect): Promise<void> {
    return new Promise((resolve, reject) => {
      const originalSound = this.sounds.get(effect);
      
      if (!originalSound) {
        console.warn(`Sound not found: ${effect}`);
        reject(new Error(`Sound not found: ${effect}`));
        return;
      }

      try {
        // Create a completely new Howl instance for each play to avoid interruption
        const sound = new Howl({
          src: ['/sounds/sharp-pop-328170.mp3'],
          volume: this.volume,
          html5: true, // Use HTML5 Audio for better performance and to avoid WebAudio limitations
          preload: false, // Don't preload, play immediately
          autoplay: false,
          loop: false,
          onloaderror: (_id, err) => {
            reject(new Error(`Failed to load sound: ${err}`));
          }
        });
        
        // Play the new instance immediately
        const id = sound.play();
        
        if (id) {
          let resolved = false;
          
          // Clean up when done
          const cleanup = () => {
            if (!resolved) {
              resolved = true;
              // Unload the sound after a short delay to ensure playback completes
              setTimeout(() => {
                sound.unload();
              }, 100);
            }
          };
          
          sound.once('end', () => {
            cleanup();
            resolve();
          }, id);
          
          sound.once('stop', () => {
            cleanup();
            resolve();
          }, id);
          
          sound.once('playerror', (_id, err) => {
            cleanup();
            reject(new Error(`Sound play error: ${err}`));
          }, id);
          
          // Fallback timeout
          setTimeout(() => {
            if (!resolved) {
              cleanup();
              resolve();
            }
          }, 2000);
        } else {
          sound.unload();
          reject(new Error(`Sound.play() returned falsy ID`));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  playMultiple(effects: SoundEffect[]): Promise<void[]> {
    return Promise.all(effects.map(effect => this.play(effect)));
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => {
      sound.volume(this.volume);
    });
  }

  mute() {
    this.sounds.forEach(sound => {
      sound.mute(true);
    });
  }

  unmute() {
    this.sounds.forEach(sound => {
      sound.mute(false);
    });
  }

  stopAll() {
    this.sounds.forEach(sound => {
      sound.stop();
    });
  }

  isReady(): boolean {
    return this.isLoaded;
  }
}

// Create singleton instance
export const balloonSoundManager = new BalloonSoundManager();

// Hook for using sound manager in components
export const useBalloonSound = () => {
  return {
    play: (effect: SoundEffect) => balloonSoundManager.play(effect),
    playMultiple: (effects: SoundEffect[]) => balloonSoundManager.playMultiple(effects),
    setVolume: (volume: number) => balloonSoundManager.setVolume(volume),
    mute: () => balloonSoundManager.mute(),
    unmute: () => balloonSoundManager.unmute(),
    stopAll: () => balloonSoundManager.stopAll(),
    isReady: () => balloonSoundManager.isReady()
  };
};