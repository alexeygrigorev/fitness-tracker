const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable Hermes for web platform - browsers don't support Hermes bytecode
// Hermes is only for React Native mobile (iOS/Android)
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.serializer = {
  ...config.serializer,
  // Use standard JavaScript for web instead of Hermes bytecode
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;
