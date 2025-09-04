// Debug configuration for controlling verbose logging
// Set these flags to false to disable specific debug logs

export const DEBUG_CONFIG = {
  // Master switch - disables all debug logging when false
  ENABLED: true,
  
  // Individual debug categories
  AUTH_FLOW: true,         // Authentication flow debugging
  STORAGE: false,          // Storage operations debugging
  II_INTEGRATION: false,   // Internet Identity integration debugging
  FETCH_INTERCEPT: false,  // Fetch request interception debugging
  DEEP_LINKS: true,        // Deep link handling debugging
  JSON_PARSE: false,       // JSON parsing debugging
  ED25519_FIX: false,     // Ed25519 key identity fixing
  GAME_FLOW: false,       // Game flow debugging
  API_CALLS: false,       // API call debugging
  AUTH_SESSION_V6: false, // AuthSession V6 debugging
};

// Helper function for conditional logging
export function debugLog(category: keyof typeof DEBUG_CONFIG, ...args: any[]) {
  if (DEBUG_CONFIG.ENABLED && DEBUG_CONFIG[category]) {
    console.log(...args);
  }
}

// Helper function for conditional error logging
export function debugError(category: keyof typeof DEBUG_CONFIG, ...args: any[]) {
  if (DEBUG_CONFIG.ENABLED && DEBUG_CONFIG[category]) {
    console.error(...args);
  }
}

// Helper function for conditional warning logging
export function debugWarn(category: keyof typeof DEBUG_CONFIG, ...args: any[]) {
  if (DEBUG_CONFIG.ENABLED && DEBUG_CONFIG[category]) {
    console.warn(...args);
  }
}
