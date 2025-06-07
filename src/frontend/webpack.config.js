const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: [
        '@dfinity/agent',
        '@dfinity/auth-client',
        '@dfinity/candid',
        '@dfinity/identity',
        '@dfinity/principal'
      ]
    }
  }, argv);
  
  // Polyfillsの設定
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
  };
  
  return config;
};