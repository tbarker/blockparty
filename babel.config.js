module.exports = {
  ignore: ['*.min.js'],
  compact: false,
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: ['>0.25%', 'not dead'],
        },
      },
    ],
    [
      '@babel/preset-react',
      {
        // Use the automatic JSX runtime (React 17+).
        // This compiles JSX to jsx() calls from 'react/jsx-runtime' instead of
        // React.createElement(), eliminating the need to import React in every
        // file that uses JSX.
        // See: https://reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html
        runtime: 'automatic',
      },
    ],
  ],
  plugins: ['@babel/plugin-transform-runtime'],
};
