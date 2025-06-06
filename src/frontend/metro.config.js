const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro bundlerの最適化
config.server = {
  ...config.server,
  port: 8081,
};

config.resolver = {
  ...config.resolver,
  resetCache: true,
};

module.exports = config;