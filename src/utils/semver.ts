/**
 * Semantic Version Utilities
 * 
 * Provides utilities for comparing semantic versions in the format:
 * MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * 
 * Examples: 1.0.0, 1.2.3, 2.0.0-beta.1, 1.0.0+20250104
 */

export interface SemanticVersion {
  major: number
  minor: number
  patch: number
  prerelease?: string
  build?: string
  raw: string
}

/**
 * Parse a semantic version string into components
 */
export function parseVersion(version: string): SemanticVersion {
  // Remove 'v' prefix if present
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version
  
  // Regex to parse semantic version
  // Format: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
  const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
  
  const match = cleanVersion.match(regex)
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`)
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || undefined,
    build: match[5] || undefined,
    raw: version
  }
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  try {
    const versionA = parseVersion(a)
    const versionB = parseVersion(b)
    
    // Compare major version
    if (versionA.major !== versionB.major) {
      return versionA.major > versionB.major ? 1 : -1
    }
    
    // Compare minor version
    if (versionA.minor !== versionB.minor) {
      return versionA.minor > versionB.minor ? 1 : -1
    }
    
    // Compare patch version
    if (versionA.patch !== versionB.patch) {
      return versionA.patch > versionB.patch ? 1 : -1
    }
    
    // Handle prerelease versions
    // No prerelease > prerelease
    if (!versionA.prerelease && versionB.prerelease) return 1
    if (versionA.prerelease && !versionB.prerelease) return -1
    
    // Both have prerelease - compare lexically
    if (versionA.prerelease && versionB.prerelease) {
      if (versionA.prerelease !== versionB.prerelease) {
        return versionA.prerelease > versionB.prerelease ? 1 : -1
      }
    }
    
    // Versions are equal (build metadata is ignored in comparison)
    return 0
    
  } catch (error) {
    // Fallback to string comparison if parsing fails
    console.warn('Semantic version comparison failed, falling back to string comparison:', error)
    return a.localeCompare(b)
  }
}

/**
 * Check if version A is greater than version B
 */
export function isVersionGreater(a: string, b: string): boolean {
  return compareVersions(a, b) > 0
}

/**
 * Check if version A is equal to version B
 */
export function isVersionEqual(a: string, b: string): boolean {
  return compareVersions(a, b) === 0
}

/**
 * Check if version A is less than version B
 */
export function isVersionLess(a: string, b: string): boolean {
  return compareVersions(a, b) < 0
}

/**
 * Validate if a string is a valid semantic version
 */
export function isValidVersion(version: string): boolean {
  try {
    parseVersion(version)
    return true
  } catch {
    return false
  }
}

/**
 * Get the latest version from an array of version strings
 */
export function getLatestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null
  
  return versions.reduce((latest, current) => {
    return isVersionGreater(current, latest) ? current : latest
  })
}

/**
 * Format version info for display
 */
export function formatVersionInfo(version: SemanticVersion): string {
  let formatted = `${version.major}.${version.minor}.${version.patch}`
  
  if (version.prerelease) {
    formatted += `-${version.prerelease}`
  }
  
  if (version.build) {
    formatted += `+${version.build}`
  }
  
  return formatted
}