// Early patches that need to be applied before any modules are loaded
// This file should be imported at the very top of the app

console.log('🚀 Applying early patches...');

// Patch global crypto if needed
if (typeof global !== 'undefined' && !global.crypto) {
  console.log('🚀 Setting up global.crypto');
  global.crypto = {
    getRandomValues: (array: Uint8Array) => {
      console.log('🚀 global.crypto.getRandomValues called');
      const timestamp = Date.now();
      const rand = Math.random() * 1000000;
      
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor((timestamp + rand + i * 137 + (i * i * 31)) % 256);
      }
      
      return array;
    }
  };
}

// Pre-patch Ed25519KeyIdentity before it's used
try {
  // Force load the identity module
  const identity = require('@dfinity/identity');
  
  if (identity && identity.Ed25519KeyIdentity) {
    const originalGenerate = identity.Ed25519KeyIdentity.generate;
    
    identity.Ed25519KeyIdentity.generate = function(seed?: Uint8Array) {
      console.log('🚀 Early patch: Ed25519KeyIdentity.generate called');
      
      // Always use a valid seed
      if (!seed || seed.length !== 32) {
        seed = new Uint8Array(32);
      }
      
      // Check for dev seed pattern (1,2,3,4,5,6,7,8...)
      const isDevSeed = seed.length === 32 && 
        seed[0] === 1 && seed[1] === 2 && seed[2] === 3 && seed[3] === 4;
      
      if (isDevSeed) {
        console.log('🚀 Early patch: Dev seed detected, using as-is');
        // Don't modify the dev seed
        return originalGenerate.call(this, seed);
      }
      
      // Check if all zeros
      const isAllZeros = Array.from(seed).every(b => b === 0);
      if (isAllZeros) {
        console.log('🚀 Early patch: Fixing all-zero seed');
        const timestamp = Date.now();
        const rand = Math.random() * 1000000;
        
        for (let i = 0; i < 32; i++) {
          seed[i] = Math.floor((timestamp + rand + i * 137 + (i * i * 31)) % 256);
        }
      }
      
      // Try to generate key
      let attempts = 0;
      let result;
      
      while (attempts < 5) {
        attempts++;
        try {
          result = originalGenerate.call(this, seed);
          
          // Verify it's not all zeros
          const json = result.toJSON();
          if (typeof json === 'string') {
            const parts = json.includes('[') ? JSON.parse(json) : json.split(',');
            if (parts[1] !== '0000000000000000000000000000000000000000000000000000000000000000') {
              console.log('🚀 Early patch: Successfully generated valid key');
              return result;
            }
          }
          
          console.log(`🚀 Early patch: Attempt ${attempts} produced all-zero key, retrying...`);
          
          // Check if it's still a dev seed
          const stillDevSeed = seed.length === 32 && 
            seed[0] === 1 && seed[1] === 2 && seed[2] === 3 && seed[3] === 4;
          
          if (stillDevSeed) {
            console.log('🚀 Early patch: Dev seed should not produce all-zero key, returning as-is');
            break;
          }
          
          // Generate new seed
          for (let i = 0; i < 32; i++) {
            seed[i] = Math.floor(Math.random() * 256);
          }
        } catch (e) {
          console.error('🚀 Early patch: Error in generate:', e);
          break;
        }
      }
      
      return result || originalGenerate.call(this, seed);
    };
    
    console.log('🚀 Early patch: Ed25519KeyIdentity.generate patched');
  }
} catch (e) {
  console.log('🚀 Early patch: Could not patch Ed25519KeyIdentity:', e);
}

console.log('🚀 Early patches applied');

export {};