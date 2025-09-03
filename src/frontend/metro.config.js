const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const exclusionList = require('metro-config/src/defaults/exclusionList');
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

// 明示的にプロジェクト外のバックアップフォルダを除外
try {
  const backupDir = path.resolve(__dirname, '../frontend-vite-backup');
  const escaped = backupDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  config.resolver.blockList = exclusionList([
    new RegExp(`${escaped}.*`),
  ]);
} catch (e) {
  // no-op: exclusion is best-effort
}

module.exports = withNativeWind(config, { input: './app/global.css' });
