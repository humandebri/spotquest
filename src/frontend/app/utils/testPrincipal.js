// Test the custom Principal implementation
const { Buffer } = require('buffer');

const CRC_LENGTH_IN_BYTES = 4;

// CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const polynomial = 0xEDB88320;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ polynomial;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Base32 encoding/decoding
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  const cleanInput = input.replace(/=/g, '').toUpperCase();
  
  let binaryString = '';
  for (const char of cleanInput) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    binaryString += index.toString(2).padStart(5, '0');
  }
  
  const bytes = [];
  for (let i = 0; i + 8 <= binaryString.length; i += 8) {
    bytes.push(parseInt(binaryString.substr(i, 8), 2));
  }
  
  return new Uint8Array(bytes);
}

function base32Encode(data) {
  let binaryString = '';
  for (const byte of data) {
    binaryString += byte.toString(2).padStart(8, '0');
  }
  
  while (binaryString.length % 5 !== 0) {
    binaryString += '0';
  }
  
  let result = '';
  for (let i = 0; i < binaryString.length; i += 5) {
    const chunk = binaryString.substr(i, 5);
    const index = parseInt(chunk, 2);
    result += BASE32_ALPHABET[index];
  }
  
  return result;
}

// Custom Principal class
class CustomPrincipal {
  constructor(bytes = new Uint8Array(0)) {
    this._bytes = bytes;
    this._hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  
  static fromText(text) {
    console.log('🎯 CustomPrincipal.fromText called with:', text);
    
    const cleanText = text.replace(/-/g, '');
    const padLength = Math.ceil(cleanText.length / 8) * 8 - cleanText.length;
    const paddedText = cleanText.toUpperCase() + '='.repeat(padLength);
    
    const decoded = base32Decode(paddedText);
    
    if (decoded.length < CRC_LENGTH_IN_BYTES) {
      throw new Error('Principal too short');
    }
    
    const checksum = decoded.slice(0, CRC_LENGTH_IN_BYTES);
    const data = decoded.slice(CRC_LENGTH_IN_BYTES);
    
    const principal = new CustomPrincipal(data);
    const expectedText = principal.toText();
    
    if (expectedText !== text) {
      console.error('Principal verification failed:', { expected: expectedText, actual: text });
      throw new Error('Principal checksum mismatch');
    }
    
    console.log('🎯 CustomPrincipal created successfully');
    return principal;
  }
  
  toText() {
    const checksum = crc32(this._bytes);
    const checksumBytes = new Uint8Array(4);
    checksumBytes[0] = (checksum >>> 24) & 0xFF;
    checksumBytes[1] = (checksum >>> 16) & 0xFF;
    checksumBytes[2] = (checksum >>> 8) & 0xFF;
    checksumBytes[3] = checksum & 0xFF;
    
    const combined = new Uint8Array(checksumBytes.length + this._bytes.length);
    combined.set(checksumBytes, 0);
    combined.set(this._bytes, checksumBytes.length);
    
    const encoded = base32Encode(combined).toLowerCase().replace(/=/g, '');
    
    let result = '';
    for (let i = 0; i < encoded.length; i += 5) {
      if (i > 0) result += '-';
      result += encoded.substr(i, 5);
    }
    
    return result;
  }
  
  toString() {
    return this.toText();
  }
  
  get bytes() {
    return this._bytes;
  }
  
  get hex() {
    return this._hex;
  }
}

console.log('Testing CustomPrincipal...');

try {
  const canisterId = '77fv5-oiaaa-aaaal-qsoea-cai';
  console.log('Input canister ID:', canisterId);
  
  const principal = CustomPrincipal.fromText(canisterId);
  console.log('Principal created successfully');
  console.log('Principal toString():', principal.toString());
  console.log('Principal bytes length:', principal.bytes.length);
  console.log('Principal hex:', principal.hex);
  
  const roundtripText = principal.toText();
  console.log('Roundtrip result:', roundtripText);
  console.log('Matches original:', roundtripText === canisterId);
  
} catch (error) {
  console.error('Test failed:', error);
  console.error('Error details:', {
    message: error.message,
    stack: error.stack,
  });
}