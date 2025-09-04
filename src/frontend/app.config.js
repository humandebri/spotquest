import 'dotenv/config';

// Derive iOS Google scheme from client ID if provided via env
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const GOOGLE_IOS_SCHEME = GOOGLE_CLIENT_ID_IOS
  ? `com.googleusercontent.apps.${GOOGLE_CLIENT_ID_IOS.replace('.apps.googleusercontent.com', '')}`
  : undefined;

const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME || 'spotquest';

export default {
  expo: {
    name: "SpotQuest",
    slug: "spotquest",
    // Register both app scheme and Google iOS scheme for native auth redirects
    scheme: [APP_SCHEME, GOOGLE_IOS_SCHEME].filter(Boolean),
    owner: "hude",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/app_icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#1a1a2e"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.spotquest.app",
      buildNumber: "18",
      infoPlist: {
        CFBundleIconName: "AppIcon",
        NSCameraUsageDescription: "This app needs access to camera to take photos for the game.",
        NSPhotoLibraryUsageDescription: "This app needs access to photo library to select photos for the game.",
        NSLocationWhenInUseUsageDescription: "This app needs location access to tag photos with GPS coordinates.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs location access to tag photos with GPS coordinates.",
        ITSAppUsesNonExemptEncryption: false,
        UIStatusBarHidden: true,
        UIViewControllerBasedStatusBarAppearance: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1a1a2e"
      },
      edgeToEdgeEnabled: true,
      package: "com.spotquest.app",
      permissions: [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.RECORD_AUDIO"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    linking: {
      prefixes: [
        `${APP_SCHEME}://`, // custom scheme
        // Use modern Expo Auth proxy domain
        process.env.EXPO_PUBLIC_AUTH_PROXY_URL || "https://auth.expo.dev/@hude/spotquest",
        process.env.EXPO_PUBLIC_APP_WEB_URL || "https://spotquest.app",
      ],
      config: {
        screens: {
          auth: "auth"
        }
      }
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow SpotQuest to use your location."
        }
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow SpotQuest to use camera."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "The app accesses your photos to let you share them with your friends."
        }
      ],
      "expo-secure-store",
      "expo-router",
      "expo-web-browser"
    ],
    extra: {
      eas: {
        projectId: "9678017a-a501-4056-b9b1-731058b792b1"
      }
    }
  }
};
