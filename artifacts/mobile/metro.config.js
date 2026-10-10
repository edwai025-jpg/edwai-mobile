const { getDefaultConfig } = require("expo/metro-config");

// Native build tools can invoke Metro directly, bypassing package.json's build script.
require("./scripts/generate-stem-assets.cjs");

module.exports = getDefaultConfig(__dirname);
