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

// Ed25519KeyIdentity patch is no longer needed since we use fixed test keys in dev mode
console.log('🚀 Early patch: Using fixed test identity for dev mode (no patching needed)');

console.log('🚀 Early patches applied');

export {};