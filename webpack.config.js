const path = require('path');

module.exports = {
  entry: path.join(__dirname, 'src/init'),
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'bundle.js',
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: [['env', {
            targets: {
              browsers: ['> 1%', 'last 2 major versions'],
            },
          }]],
        },
      },
      {
        test: /\.glsl$/,
        loader: 'webpack-glsl-loader'
      },
    ],
  },
  devtool: 'source-map',
  devServer: {
    port: 5650,
    publicPath: '/build/'
  },
};