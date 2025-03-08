module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          allowlist: null,
          denylist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};
