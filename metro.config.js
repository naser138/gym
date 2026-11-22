// Metro config: expo-sqlite on web loads its engine as a .wasm asset.
// No COOP/COEP headers: expo-sqlite only needs SharedArrayBuffer for its synchronous API,
// and this app uses the async API exclusively – so the site works on GitHub Pages as-is.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
