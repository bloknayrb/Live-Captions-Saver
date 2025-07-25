const path = require('path');

module.exports = {
  entry: {
    'content_script': './teams-captions-saver/src/content-script.js',
    'service_worker': './teams-captions-saver/service_worker.js',
    'popup': './teams-captions-saver/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'teams-captions-saver/dist'),
    filename: '[name].bundle.js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  },
  target: ['web', 'es5'],
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: false, // Keep readable for debugging Chrome extension
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  externals: {
    chrome: 'chrome'
  }
};