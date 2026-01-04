# JSX Runtime Fix (January 2026)

## Problem

After commit `d87d0ba` ("Fix all the linting!"), the E2E tests failed with:

```
ReferenceError: React is not defined
```

## Root Cause

The linting fix removed the `React` import from `src/index.js`:

```diff
- import React, { useState } from 'react';
+ import { useState } from 'react';
```

However, the project's Babel configuration was using the "classic" JSX transform, which compiles JSX to `React.createElement()` calls. Without `React` in scope, this caused a runtime error.

## Solution

Updated the Babel preset-react configuration to use the "automatic" JSX runtime (React 17+ feature):

### webpack.config.js

The main webpack config had inline babel options that needed updating:

```javascript
{
  loader: 'babel-loader',
  options: {
    presets: [
      '@babel/preset-env',
      [
        '@babel/preset-react',
        {
          // Use the automatic JSX runtime (React 17+).
          // This compiles JSX to jsx() calls from 'react/jsx-runtime' instead of
          // React.createElement(), eliminating the need to import React in every
          // file that uses JSX.
          runtime: 'automatic',
        },
      ],
    ],
    plugins: ['@babel/plugin-transform-runtime'],
  },
}
```

### babel.config.js

Also created a `babel.config.js` (replacing `.babelrc`) with the same settings for consistency.

## Key Learnings

1. JSON files (`.babelrc`) don't support comments - use `babel.config.js` for commented configs
2. Webpack's inline babel options override `babel.config.js` - both need to be updated
3. The "automatic" JSX runtime compiles JSX to `jsx()` calls from `react/jsx-runtime` instead of `React.createElement()`, so explicit React imports are no longer needed in files that only use JSX

## References

- https://reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html
