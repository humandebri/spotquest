const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Metro bundlerの設定
config.resolver = {
  ...config.resolver,
  // node_modulesの解決
  nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  // polyfills
  extraNodeModules: {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
  },
};

// watcherの設定を追加
config.watchFolders = [path.resolve(__dirname)];

module.exports = withNativeWind(config, { input: './src/global.css' });