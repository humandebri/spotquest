// Custom Principal implementation for React Native (no WebAssembly dependency)
import { Buffer } from 'buffer';

const CRC_LENGTH_IN_BYTES = 4;
const HASH_LENGTH_IN_BYTES = 28;
const MAX_LENGTH_IN_BYTES = 29;

// CRC32 implementation
function crc32(data: Uint8Array): number {
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

function base32Decode(input: string): Uint8Array {
  // Remove padding and convert to uppercase
  const cleanInput = input.replace(/=/g, '').toUpperCase();
  
  // Convert to binary string
  let binaryString = '';
  for (const char of cleanInput) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    binaryString += index.toString(2).padStart(5, '0');
  }
  
  // Convert binary string to bytes
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= binaryString.length; i += 8) {
    bytes.push(parseInt(binaryString.substr(i, 8), 2));
  }
  
  return new Uint8Array(bytes);
}

function base32Encode(data: Uint8Array): string {
  // Convert to binary string
  let binaryString = '';
  for (const byte of data) {
    binaryString += byte.toString(2).padStart(8, '0');
  }
  
  // Pad to multiple of 5
  while (binaryString.length % 5 !== 0) {
    binaryString += '0';
  }
  
  // Convert to base32
  let result = '';
  for (let i = 0; i < binaryString.length; i += 5) {
    const chunk = binaryString.substr(i, 5);
    const index = parseInt(chunk, 2);
    result += BASE32_ALPHABET[index];
  }
  
  return result;
}

// Custom Principal class for React Native
export class CustomPrincipal {
  private _bytes: Uint8Array;
  private _hex: string;
  
  constructor(bytes: Uint8Array = new Uint8Array(0)) {
    this._bytes = bytes;
    this._hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  
  static fromText(text: string): CustomPrincipal {
    console.log('🎯 CustomPrincipal.fromText called with:', text);
    
    // Remove hyphens
    const cleanText = text.replace(/-/g, '');
    
    // Pad for base32 decode
    const padLength = Math.ceil(cleanText.length / 8) * 8 - cleanText.length;
    const paddedText = cleanText.toUpperCase() + '='.repeat(padLength);
    
    // Decode base32
    const decoded = base32Decode(paddedText);
    
    if (decoded.length < CRC_LENGTH_IN_BYTES) {
      throw new Error('Principal too short');
    }
    
    // Extract checksum and data
    const checksum = decoded.slice(0, CRC_LENGTH_IN_BYTES);
    const data = decoded.slice(CRC_LENGTH_IN_BYTES);
    
    // Create principal and verify
    const principal = new CustomPrincipal(data);
    const expectedText = principal.toText();
    
    if (expectedText !== text) {
      console.error('Principal verification failed:', { expected: expectedText, actual: text });
      throw new Error('Principal checksum mismatch');
    }
    
    console.log('🎯 CustomPrincipal created successfully');
    return principal;
  }
  
  static anonymous(): CustomPrincipal {
    return new CustomPrincipal(new Uint8Array([0x04]));
  }
  
  static managementCanister(): CustomPrincipal {
    return new CustomPrincipal(new Uint8Array(0));
  }
  
  toText(): string {
    // Calculate CRC32 checksum
    const checksum = crc32(this._bytes);
    const checksumBytes = new Uint8Array(4);
    checksumBytes[0] = (checksum >>> 24) & 0xFF;
    checksumBytes[1] = (checksum >>> 16) & 0xFF;
    checksumBytes[2] = (checksum >>> 8) & 0xFF;
    checksumBytes[3] = checksum & 0xFF;
    
    // Combine checksum and data
    const combined = new Uint8Array(checksumBytes.length + this._bytes.length);
    combined.set(checksumBytes, 0);
    combined.set(this._bytes, checksumBytes.length);
    
    // Encode to base32
    const encoded = base32Encode(combined).toLowerCase().replace(/=/g, '');
    
    // Add hyphens
    let result = '';
    for (let i = 0; i < encoded.length; i += 5) {
      if (i > 0) result += '-';
      result += encoded.substr(i, 5);
    }
    
    return result;
  }
  
  toString(): string {
    return this.toText();
  }
  
  toUint8Array(): Uint8Array {
    return this._bytes;
  }
  
  toHex(): string {
    return this._hex;
  }
  
  get bytes(): Uint8Array {
    return this._bytes;
  }
  
  get hex(): string {
    return this._hex;
  }
  
  // Make it compatible with @dfinity/principal interface
  compareTo(other: CustomPrincipal): number {
    const minLength = Math.min(this._bytes.length, other._bytes.length);
    for (let i = 0; i < minLength; i++) {
      if (this._bytes[i] < other._bytes[i]) return -1;
      if (this._bytes[i] > other._bytes[i]) return 1;
    }
    return this._bytes.length - other._bytes.length;
  }
  
  // For @dfinity/agent compatibility
  static from(value: any): CustomPrincipal {
    if (typeof value === 'string') {
      return CustomPrincipal.fromText(value);
    } else if (value instanceof Uint8Array) {
      return new CustomPrincipal(value);
    } else if (value instanceof CustomPrincipal) {
      return value;
    }
    throw new Error('Invalid principal value');
  }
}

// Export as Principal for drop-in replacement
export const Principal = CustomPrincipal;

// For CommonJS compatibility in earlyPatches.ts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CustomPrincipal, Principal };
}