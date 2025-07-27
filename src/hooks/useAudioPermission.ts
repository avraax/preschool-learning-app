import React, { useContext } from 'react'
import { AudioPermissionContext, AudioPermissionContextType } from '../contexts/AudioPermissionContext'

/**
 * Hook to access the global audio permission system
 * Provides methods to check permissions, request permissions, and manage UI state
 */
export const useAudioPermissionHook = (): AudioPermissionContextType => {
  const context = useContext(AudioPermissionContext)
  
  if (context === undefined) {
    throw new Error('useAudioPermissionHook must be used within an AudioPermissionProvider')
  }
  
  return context
}

/**
 * Convenience hook that automatically sets needsPermission to true
 * Use this in components that will definitely need audio
 */
export const useAudioRequired = () => {
  const audioPermission = useAudioPermissionHook()
  
  // Mark that this component needs audio
  React.useEffect(() => {
    audioPermission.setNeedsPermission(true)
    
    return () => {
      // Optionally clean up when component unmounts
      // audioPermission.setNeedsPermission(false)
    }
  }, [audioPermission])
  
  return audioPermission
}