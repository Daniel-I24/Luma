// @ts-check
/**
 * luma/layer-boundaries — dependencies flow features → shared → core
 * (design-system is usable from shared and features, and itself only
 * depends on core). A feature never imports another feature. Resolves both
 * the path aliases (@core, @shared, @design-system, @features) and relative
 * imports.
 */
const path = require('node:path');

const APP = path.join(__dirname, '..', 'src', 'app');
const ALIASES = { '@core': 'core', '@shared': 'shared', '@design-system': 'design-system', '@features': 'features' };
/** Layers each layer may import (besides itself). */
const ALLOWED = {
  core: [],
  'design-system': ['core'],
  shared: ['core', 'design-system'],
  features: ['core', 'design-system', 'shared'],
};

/** "features/map" → { layer: 'features', feature: 'map' } for a path inside src/app. */
function locate(file) {
  const relative = path.relative(APP, file).split(path.sep);
  if (relative[0] === '..' || !(relative[0] in ALLOWED)) return null;
  return { layer: relative[0], feature: relative[0] === 'features' ? relative[1] : null };
}

function targetOf(source, file) {
  const alias = Object.keys(ALIASES).find((a) => source === a || source.startsWith(`${a}/`));
  if (alias) return locate(path.join(APP, ALIASES[alias], source.slice(alias.length)));
  if (source.startsWith('.')) return locate(path.resolve(path.dirname(file), source));
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const layerBoundaries = {
  meta: {
    type: 'problem',
    docs: { description: 'Imports follow features → shared → core; no feature imports another feature.' },
    messages: {
      layer: "'{{from}}' may not import from '{{to}}' (dependencies flow features → shared → core).",
      feature: "Feature '{{from}}' may not import from feature '{{to}}'; move the code to shared/.",
    },
    schema: [],
  },
  create(context) {
    const from = locate(context.filename);
    if (!from) return {};
    return {
      ImportDeclaration(node) {
        const to = targetOf(String(node.source.value), context.filename);
        if (!to) return;
        if (to.layer === 'features' && from.layer === 'features' && to.feature !== from.feature) {
          context.report({ node, messageId: 'feature', data: { from: from.feature ?? '', to: to.feature ?? '' } });
        } else if (to.layer !== from.layer && !ALLOWED[from.layer].includes(to.layer)) {
          context.report({ node, messageId: 'layer', data: { from: from.layer, to: to.layer } });
        }
      },
    };
  },
};

module.exports = { layerBoundaries };
