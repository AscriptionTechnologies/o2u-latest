module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  plugins.push([
    'react-native-reanimated/plugin',
    {
      strict: false,
    },
  ]);

  return {
    presets: ['babel-preset-expo'],

    plugins,
  };
};
