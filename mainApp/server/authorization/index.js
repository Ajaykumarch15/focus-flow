// authorization/index.js — Public API for the authorization package.
//
// Re-exports the central authorization function, relationship helpers,
// permission vocabulary, and middleware factories.

const { can } = require('./authorization');
const relationships = require('./relationships');
const permissions = require('./permissions');
const middleware = require('./middleware');

module.exports = {
  can,
  ...relationships,
  ...permissions,
  ...middleware,
};
