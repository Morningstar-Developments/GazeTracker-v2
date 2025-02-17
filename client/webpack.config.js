const path = require('path');

module.exports = {
  devServer: {
    allowedHosts: 'all',
    host: 'localhost',
    port: 3000,
    hot: true,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    proxy: {
      '/api': 'http://localhost:3001'
    },
  }
}; 