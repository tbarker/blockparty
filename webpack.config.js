const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'app.js',
  },
  // Optimization settings to handle SDK bundling issues
  optimization: {
    // Disable concatenation for modules that have complex ESM/CJS interop issues
    concatenateModules: false,
  },
  plugins: [
    // Handle node: protocol imports (required by @ardrive/turbo-sdk)
    new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
      resource.request = resource.request.replace(/^node:/, '');
    }),
    // Provide polyfills for Node.js core modules (required by ethers.js)
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    // Expose environment variables to the frontend
    new webpack.DefinePlugin({
      'process.env.ENS_ADDRESS': JSON.stringify(process.env.ENS_ADDRESS),
      'process.env.CONTRACT_ADDRESS': JSON.stringify(process.env.CONTRACT_ADDRESS),
      'process.env.FACTORY_ADDRESS': JSON.stringify(process.env.FACTORY_ADDRESS),
      'process.env.SEPOLIA_RPC_URL': JSON.stringify(process.env.SEPOLIA_RPC_URL),
      'process.env.WALLETCONNECT_PROJECT_ID': JSON.stringify(process.env.WALLETCONNECT_PROJECT_ID),
    }),
    // Generate index.html with injected script tags
    new HtmlWebpackPlugin({
      template: './public/index.html',
      inject: true,
    }),
  ],
  resolve: {
    // Polyfills for Node.js core modules used by ethers.js
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      os: require.resolve('os-browserify/browser'),
      url: require.resolve('url'),
      assert: require.resolve('assert'),
      path: require.resolve('path-browserify'),
      fs: false,
      net: false,
      tls: false,
      child_process: false,
      vm: false,
    },
    // Alias for process/browser (axios imports without .js extension)
    // Also mock React Native modules that @metamask/sdk tries to import
    alias: {
      'process/browser': require.resolve('process/browser.js'),
      // Mock React Native async storage - not needed in browser environment
      '@react-native-async-storage/async-storage': false,
    },
    // Allow importing without full extension (needed for some ESM modules)
    fullySpecified: false,
    extensions: ['.js', '.jsx', '.json'],
  },
  // Ignore warnings that don't affect functionality
  ignoreWarnings: [
    // ethers.js critical dependency warnings are false positives
    {
      module: /node_modules\/ethers/,
      message: /Critical dependency/,
    },
    // @metamask/sdk tries to import React Native modules that aren't needed in browser
    {
      module: /node_modules\/@metamask\/sdk/,
      message: /Can't resolve '@react-native-async-storage/,
    },
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      // "file" loader makes sure those assets get served by WebpackDevServer.
      // When you `import` an asset, you get its (virtual) filename.
      // In production, they would get copied to the `build` folder.
      {
        test: /\.(ico|jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/media/[name].[hash:8][ext]',
        },
      },
      // "url" loader works just like "file" loader but it also embeds
      // assets smaller than specified size as data URLs to avoid requests.
      {
        test: /\.(mp4|webm|wav|mp3|m4a|aac|oga)(\?.*)?$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10000,
          },
        },
        generator: {
          filename: 'static/media/[name].[hash:8][ext]',
        },
      },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
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
                  // See: https://reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html
                  runtime: 'automatic',
                },
              ],
            ],
            plugins: ['@babel/plugin-transform-runtime'],
          },
        },
      },
    ],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 8080,
    hot: true,
  },
};
