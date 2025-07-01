// Environment constants
// Force mainnet for all environments - no localhost for physical devices
export const DFX_NETWORK = 'ic';
export const LOCAL_IP_ADDRESS = process.env.EXPO_PUBLIC_LOCAL_IP_ADDRESS || '127.0.0.1';

// Canister IDs
export const CANISTER_ID_UNIFIED = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';
export const CANISTER_ID_FRONTEND = process.env.EXPO_PUBLIC_FRONTEND_CANISTER_ID || '7yetj-dqaaa-aaaal-qsoeq-cai';
export const CANISTER_ID_II_INTEGRATION = process.env.EXPO_PUBLIC_II_INTEGRATION_CANISTER_ID || '';

// IC Host
export const IC_HOST = process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app';

// App scheme for deep links
export const APP_SCHEME = 'spotquest';

// Admin principals
export const ADMIN_PRINCIPALS = [
  '4wbqy-noqfb-3dunk-64f7k-4v54w-kzvti-l24ky-jaz3f-73y36-gegjt-cqe',
  '2vxsx-fae', // Development test principal
];

// Internet Identity URL
export const INTERNET_IDENTITY_URL = process.env.EXPO_PUBLIC_INTERNET_IDENTITY_URL || 'https://identity.ic0.app';