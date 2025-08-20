// Convert Uint8Array or ArrayBuffer to hex string
export const bytesToHex = (input: Uint8Array | ArrayBuffer): string => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};