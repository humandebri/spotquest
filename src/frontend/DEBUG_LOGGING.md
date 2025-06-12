# Debug Logging Control

The frontend codebase now uses a centralized debug configuration to control verbose logging.

## Configuration

Edit `src/utils/debugConfig.ts` to enable/disable specific debug categories:

```typescript
export const DEBUG_CONFIG = {
  // Master switch - disables all debug logging when false
  ENABLED: false,  // Set to true to enable debug logging
  
  // Individual debug categories
  AUTH_FLOW: false,        // Authentication flow debugging
  STORAGE: false,          // Storage operations debugging
  II_INTEGRATION: false,   // Internet Identity integration debugging
  FETCH_INTERCEPT: false,  // Fetch request interception debugging
  DEEP_LINKS: false,       // Deep link handling debugging
  JSON_PARSE: false,       // JSON parsing debugging
  ED25519_FIX: false,     // Ed25519 key identity fixing
  GAME_FLOW: false,       // Game flow debugging
  API_CALLS: false,       // API call debugging
};
```

## How to Enable Debugging

1. **Enable all debug logging**:
   ```typescript
   ENABLED: true,
   ```

2. **Enable specific categories only**:
   ```typescript
   ENABLED: true,
   AUTH_FLOW: true,        // Only auth flow logs
   II_INTEGRATION: true,   // Only II integration logs
   ```

3. **Disable all debug logging** (production):
   ```typescript
   ENABLED: false,  // All other flags are ignored
   ```

## Debug Categories

- **AUTH_FLOW**: Login/logout, authentication state changes, II callbacks
- **STORAGE**: AsyncStorage and SecureStore operations
- **II_INTEGRATION**: expo-ii-integration library operations, session management
- **FETCH_INTERCEPT**: HTTP request interception for II integration
- **DEEP_LINKS**: Deep link handling and URL parsing
- **JSON_PARSE**: JSON parsing operations and errors
- **ED25519_FIX**: Ed25519 key identity patching
- **GAME_FLOW**: Game session, rounds, and scoring
- **API_CALLS**: Backend API calls and responses

## Production

For production builds, ensure `ENABLED: false` to disable all debug logging.