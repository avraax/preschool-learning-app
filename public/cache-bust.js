// Cache busting helper for aggressive cache clearing
// This runs before the main app loads

(function() {
  // Add timestamp to detect new deployments
  const deploymentTime = new Date().getTime();
  const storageKey = 'børnelæring-deployment-time';
  const lastDeployment = localStorage.getItem(storageKey);
  
  // If this is a new deployment, clear all caches
  if (lastDeployment && parseInt(lastDeployment) < deploymentTime - 60000) { // 1 minute grace period
    console.log('🔄 New deployment detected, clearing caches...');
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
    
    // Clear localStorage cache (but preserve settings)
    const keysToPreserve = ['difficulty-level', 'børnelæring-session-id'];
    const preservedData = {};
    
    keysToPreserve.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        preservedData[key] = value;
      }
    });
    
    // Clear all localStorage
    localStorage.clear();
    
    // Restore preserved data
    Object.entries(preservedData).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    
    // Force reload to get fresh content
    if (!window.location.search.includes('cache-cleared')) {
      window.location.href = window.location.href + (window.location.search ? '&' : '?') + 'cache-cleared=true';
      return;
    }
  }
  
  // Store current deployment time
  localStorage.setItem(storageKey, deploymentTime.toString());
  
  // Remove cache-cleared param if present
  if (window.location.search.includes('cache-cleared=true')) {
    const url = new URL(window.location.href);
    url.searchParams.delete('cache-cleared');
    window.history.replaceState({}, document.title, url.toString());
  }
})();