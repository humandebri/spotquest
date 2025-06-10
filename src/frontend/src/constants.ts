// Admin principals for admin access
export const ADMIN_PRINCIPALS = [
  'lqfvd-m7ihy-e5dvc-gngvr-blzbt-pupeq-6t7ua-r7v4p-bvqjw-ea7gl-4qe', // Example admin principal
];

// Get environment variables with proper defaults
export const LOCAL_IP_ADDRESS = process.env.EXPO_PUBLIC_LOCAL_IP_ADDRESS || '127.0.0.1';
export const DFX_NETWORK = process.env.EXPO_PUBLIC_DFX_NETWORK || 'ic';
export const CANISTER_ID_II_INTEGRATION = process.env.EXPO_PUBLIC_II_INTEGRATION_CANISTER_ID;
export const CANISTER_ID_FRONTEND = process.env.EXPO_PUBLIC_FRONTEND_CANISTER_ID || '7yetj-dqaaa-aaaal-qsoeq-cai';
export const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME || 'guessthespot';

// Other canister IDs
export const CANISTER_ID_UNIFIED = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';
export const IC_HOST = process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app';
export const INTERNET_IDENTITY_URL = process.env.EXPO_PUBLIC_INTERNET_IDENTITY_URL || 'https://identity.ic0.app';