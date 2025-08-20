// Safe JSON parsing utility to prevent parse errors
import { DEBUG_CONFIG, debugLog, debugWarn } from './debugConfig';

export function safeParse<T = any>(text: string, fallback?: T): T | null {
  try {
    return JSON.parse(text);
  } catch (error) {
    // Only log in development
    if (__DEV__) {
      debugWarn('JSON_PARSE', 'JSON parse failed:', error);
    }
    return fallback !== undefined ? fallback : null;
  }
}

// Safe fetch wrapper that handles non-JSON responses
export async function safeFetch(url: string, options?: RequestInit): Promise<{
  ok: boolean;
  status: number;
  data: any;
  error?: string;
}> {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    let data: any;
    
    // Check if response is JSON
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      data = safeParse(text);
    } else {
      // Non-JSON response
      const text = await response.text();
      data = { message: text };
    }
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// Override global JSON.parse to add logging (development only)
export function enableJSONParseLogging() {
  if (__DEV__ && DEBUG_CONFIG.JSON_PARSE) {
    const originalParse = JSON.parse;
    JSON.parse = function(text: any, reviver?: any) {
      // Handle non-string inputs
      if (typeof text !== 'string') {
        // Special handling for Ed25519KeyIdentity arrays
        if (Array.isArray(text) && text.length === 2 && 
            typeof text[0] === 'string' && typeof text[1] === 'string') {
          return text;
        }
        
        // If it's an array containing "expo-ii-integration.appKey", this is from storage.find()
        // This should be the list of keys, not the stored values
        if (Array.isArray(text)) {
          // Check if this looks like a list of storage keys
          if (text.some(item => typeof item === 'string' && item.includes('expo-ii-integration'))) {
            return text;
          }
          // Otherwise, return empty array for safety
          return [];
        }
        
        // If it's already an object, stringify then parse it
        if (typeof text === 'object' && text !== null) {
          try {
            text = JSON.stringify(text);
          } catch (e) {
            return null;
          }
        }
        
        // Try to convert to string
        if (text !== null && text !== undefined) {
          text = String(text);
        } else {
          return null;
        }
      }
      
      try {
        const result = originalParse.call(this, text, reviver);
        if (DEBUG_CONFIG.JSON_PARSE && typeof text === 'string' && text.length < 200) {
          debugLog('JSON_PARSE', 'JSON.parse success:', text.substring(0, 100));
        }
        return result;
      } catch (error) {
        if (DEBUG_CONFIG.JSON_PARSE) {
          debugLog('JSON_PARSE', 'JSON.parse error:', error, 'Input:', text);
        }
        throw error;
      }
    };
  }
}