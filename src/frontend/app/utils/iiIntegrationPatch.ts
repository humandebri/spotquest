// Patch for expo-ii-integration to handle HTML responses from canister
import { DEBUG_CONFIG, debugLog } from './debugConfig';

export function patchIIIntegrationFetch() {
  const originalFetch = global.fetch;
  
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // Debug all auth-related requests
    if (url && (url.includes('77fv5-oiaaa-aaaal-qsoea-cai') || url.includes('id.ai') || url.includes('delegation'))) {
      debugLog('FETCH_INTERCEPT', '🔧 Auth-related request:', {
        url,
        method: init?.method || 'GET',
        hasBody: !!init?.body
      });
    }
    
    // Check if this is a request to our II Integration canister
    if (url && url.includes('77fv5-oiaaa-aaaal-qsoea-cai.raw.icp0.io')) {
      debugLog('FETCH_INTERCEPT', '🔧 Intercepting II Integration request:', url);
      
      try {
        const response = await originalFetch(input, init);
        const cloned = response.clone();
        
        // Read the response text to check if it's actually JSON
        const text = await cloned.text();
        debugLog('FETCH_INTERCEPT', '🔧 Response preview:', text.substring(0, 100));
        
        // Try to parse as JSON to see if it's valid
        try {
          JSON.parse(text);
          // It's valid JSON, return the original response
          return response;
        } catch (e) {
          // Not valid JSON, check if it's HTML
          if (text.includes('<h1>') || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
            debugLog('FETCH_INTERCEPT', '🔧 Got HTML response when JSON expected');
            
            // If it's the root path request, return a mock JSON response
            if (url.endsWith('.raw.icp0.io/') || url.endsWith('.raw.icp0.io')) {
              debugLog('FETCH_INTERCEPT', '🔧 Returning mock JSON response for root path');
              return new Response(
                JSON.stringify({
                  status: 'ready',
                  canisterId: '77fv5-oiaaa-aaaal-qsoea-cai',
                  type: 'unified'
                }),
                {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                  }
                }
              );
            }
          }
          
          // For other non-JSON responses, return as-is
          return response;
        }
      } catch (error) {
        debugLog('FETCH_INTERCEPT', '🔧 Error in fetch patch:', error);
        throw error;
      }
    }
    
    // For all other requests, use the original fetch
    return originalFetch(input, init);
  };
  
  debugLog('FETCH_INTERCEPT', '🔧 Fetch patched for II Integration');
}