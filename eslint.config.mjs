import js from '@eslint/js';
import react from 'eslint-plugin-react';
import babelParser from '@babel/eslint-parser';
import globals from 'globals';

export default [
  // Base recommended config
  js.configs.recommended,
  
  // React plugin config
  {
    plugins: {
      react,
    },
    settings: {
      react: {
        version: '18.3.1',
      },
    },
  },
  
  // Main config for JS/JSX files
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: babelParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-react'],
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...globals.mocha,
        // Truffle/Web3 globals
        web3: 'readonly',
        artifacts: 'readonly',
        contract: 'readonly',
        assert: 'readonly',
        // jQuery
        $: 'readonly',
        // Node.js
        Buffer: 'readonly',
      },
    },
    rules: {
      // Error prevention
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off', // Allow console for DApp debugging
      'no-undef': 'error',

      // React specific
      'react/prop-types': 'off', // Not using PropTypes in legacy code
      'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',

      // Code style (relaxed for legacy code)
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'indent': 'off', // Don't enforce indentation in legacy code
      'comma-dangle': ['warn', 'only-multiline'],
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always'],

      // Allow certain patterns in legacy code
      'no-prototype-builtins': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-redeclare': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  
  // Test files overrides
  {
    files: ['**/*.test.js', '**/__tests__/**/*.js', 'test/**/*.js'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  
  // Migration files overrides
  {
    files: ['migrations/**/*.js'],
    rules: {
      'no-undef': 'off', // Truffle injects globals
    },
  },
  
  // Script files overrides
  {
    files: ['scripts/**/*.js'],
    rules: {
      'no-undef': 'off',
    },
  },
  
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      // Build outputs
      'build/**',
      'dist/**',
      'tmp/**',
      // Dependencies
      'node_modules/**',
      // Generated files
      'coverage/**',
      '*.min.js',
      // Config files
      'webpack.config.js',
      'jest.config.js',
      'truffle-config.js',
      // Contracts (handled by Solhint)
      'contracts/**',
    ],
  },
];
