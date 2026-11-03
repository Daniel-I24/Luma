// @ts-check
/** Local ESLint rules for Luma (see docs/architecture/patterns.md). */
const { layerBoundaries } = require('./layers');
const { noLooseFunctions } = require('./loose-functions');
const { requireJsDoc } = require('./require-jsdoc');

module.exports = {
  meta: { name: 'eslint-plugin-luma' },
  rules: {
    'layer-boundaries': layerBoundaries,
    'no-loose-functions': noLooseFunctions,
    'require-jsdoc': requireJsDoc,
  },
};
