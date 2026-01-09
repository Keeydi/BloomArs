// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for 3D model file extensions
config.resolver.assetExts.push('glb', 'gltf', 'bin');

// Configure transformer to handle ES modules from three.js
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: true,
      inlineRequires: true,
    },
  }),
};

// Fix for three.js examples module resolution
// Metro has issues with three.js package.json exports configuration
// We configure a custom resolver to handle three.js examples properly
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle three.js examples imports
  if (moduleName.startsWith('three/examples/')) {
    const threePath = path.resolve(__dirname, 'node_modules', 'three');
    const examplePath = moduleName.replace('three/', '');
    
    // Try to resolve the JSM (ES module) version
    try {
      // First try the .js file directly (ES module)
      const jsPath = path.resolve(threePath, examplePath + '.js');
      const fs = require('fs');
      if (fs.existsSync(jsPath)) {
        return { type: 'sourceFile', filePath: jsPath };
      }
    } catch (e) {
      // Continue to try other methods
    }
    
    // Fall back to default resolution
    try {
      const resolvedPath = require.resolve(moduleName, { paths: [threePath] });
      return { type: 'sourceFile', filePath: resolvedPath };
    } catch (e2) {
      // Continue to default resolver
    }
  }
  
  // Use default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

