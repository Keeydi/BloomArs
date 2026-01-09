module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      // Transform import.meta for React Native compatibility
      function() {
        return {
          visitor: {
            MetaProperty(path) {
              if (
                path.node.meta &&
                path.node.meta.name === 'import' &&
                path.node.property &&
                path.node.property.name === 'meta'
              ) {
                // Replace import.meta with an empty object to avoid "Cannot use import.meta" error
                const t = require('@babel/types');
                path.replaceWith(t.objectExpression([]));
              }
            },
          },
        };
      },
    ],
  };
};

