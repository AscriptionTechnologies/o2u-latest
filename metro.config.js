// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;

// Add support for TypeScript extensions
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'tsx',
  'ts'
];

module.exports = config;