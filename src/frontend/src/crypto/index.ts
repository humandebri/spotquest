import * as Crypto from 'expo-crypto-universal';
import { CryptoModule } from 'expo-ii-integration';

export const cryptoModule: CryptoModule = {
  // Generate a random session ID using expo-crypto-universal
  async generateSessionId(): Promise<string> {
    try {
      // Generate a random UUID
      const sessionId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${Date.now()}_${Math.random()}_session`,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      
      // Take first 32 characters for a reasonable session ID
      return sessionId.substring(0, 32);
    } catch (error) {
      console.error('Failed to generate session ID:', error);
      // Fallback to Math.random if crypto fails
      return Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15);
    }
  },
};