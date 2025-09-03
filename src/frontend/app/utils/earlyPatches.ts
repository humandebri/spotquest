// Early patches that need to be applied before any modules are loaded
// This file should be imported at the very top of the app

if (__DEV__) console.log('🚀 Applying early patches...');

// Patch global crypto if needed
if (typeof global !== 'undefined' && !global.crypto) {
  if (__DEV__) console.log('🚀 Setting up global.crypto');
  global.crypto = {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (__DEV__) console.log('🚀 global.crypto.getRandomValues called');
      if (!array || !('length' in array)) return array;
      
      const timestamp = Date.now();
      const rand = Math.random() * 1000000;
      
      const uint8Array = array as any as Uint8Array;
      for (let i = 0; i < uint8Array.length; i++) {
        uint8Array[i] = Math.floor((timestamp + rand + i * 137 + (i * i * 31)) % 256);
      }
      
      return array;
    }
  } as any;
}

// Ed25519KeyIdentity patch is no longer needed since we use fixed test keys in dev mode
if (__DEV__) console.log('🚀 Early patch: Using fixed test identity for dev mode (no patching needed)');

// Patch certificate verification for dev mode
try {
  // Only apply certificate patches in development
  if (__DEV__) {
    const agentModule = require('@dfinity/agent');
    
    if (agentModule && agentModule.Certificate) {
      const OriginalCertificate = agentModule.Certificate;
      
      // Override Certificate.prototype.verify
      if (OriginalCertificate.prototype) {
        OriginalCertificate.prototype.verify = function() {
          if (__DEV__) console.log('🚀 Certificate.verify called - returning true for dev mode');
          return true;
        };
        
        OriginalCertificate.prototype.verifyTime = async function() {
          if (__DEV__) console.log('🚀 Certificate.verifyTime called - returning true for dev mode');
          return true;
        };
      }
      
      // Override Certificate.create to return a mock certificate
      const originalCreate = OriginalCertificate.create;
      OriginalCertificate.create = async function(options: any) {
        try {
          const cert = await originalCreate.call(this, options);
          // Override the verify methods on the instance
          cert.verify = () => true;
          cert.verifyTime = async () => true;
          return cert;
        } catch (error) {
          if (__DEV__) console.log('🚀 Certificate.create error, returning mock certificate');
          // Return a mock certificate object
          return {
            cert: options.certificate,
            rootKey: options.rootKey,
            canisterId: options.canisterId,
            verify: () => true,
            verifyTime: async () => true,
            lookup: (path: any) => {
              if (path && path.length > 0) {
                const pathStr = new TextDecoder().decode(new Uint8Array(path[0]));
                if (pathStr === 'request_status') {
                  return [new TextEncoder().encode('replied')];
                }
              }
              return [new Uint8Array(0)];
            }
          };
        }
      };
      
      if (__DEV__) console.log('🚀 Certificate verification patched for dev mode');
    }
    
    // Also patch verifyCertification function if it exists
    if (agentModule && agentModule.verifyCertification) {
      agentModule.verifyCertification = () => {
        if (__DEV__) console.log('🚀 verifyCertification called - returning true for dev mode');
        return true;
      };
    }
  }
} catch (error) {
if (__DEV__) console.warn('🚀 Could not patch certificate verification:', error);
}

if (__DEV__) console.log('🚀 Early patches applied');

export {};
