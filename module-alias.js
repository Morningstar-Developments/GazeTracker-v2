const moduleAlias = require('module-alias');
const path = require('path');

moduleAlias.addAliases({
  '@core': path.join(__dirname, 'core')
}); 