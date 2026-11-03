// @ts-check
/**
 * luma/require-jsdoc — every class and every public method or getter has a
 * JSDoc block (`/** … *\/`). Implementations may use `@inheritdoc`.
 */

/** True when a `/** … *\/` block comment sits right before the node. */
function hasJsDoc(sourceCode, node) {
  const target = node.parent?.type === 'ExportNamedDeclaration' || node.parent?.type === 'ExportDefaultDeclaration'
    ? node.parent
    : node;
  // A decorated class or member keeps its JSDoc above the first decorator.
  const decorator = node.decorators?.[0];
  const first = decorator && decorator.range[0] < target.range[0] ? decorator : target;
  const before = sourceCode.getCommentsBefore(first);
  const last = before[before.length - 1];
  return !!last && last.type === 'Block' && last.value.startsWith('*');
}

/** @type {import('eslint').Rule.RuleModule} */
const requireJsDoc = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Classes and public methods carry JSDoc in English.' },
    messages: { missing: "Add a JSDoc comment to {{what}} '{{name}}'." },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      ClassDeclaration(node) {
        if (node.id && !hasJsDoc(sourceCode, node)) {
          context.report({ node: node.id, messageId: 'missing', data: { what: 'class', name: node.id.name } });
        }
      },
      'MethodDefinition, TSAbstractMethodDefinition'(node) {
        const isPublic = node.accessibility === 'public';
        const isMethod = node.kind === 'method' || node.kind === 'get';
        if (isPublic && isMethod && !hasJsDoc(sourceCode, node)) {
          const name = node.key.type === 'Identifier' ? node.key.name : 'method';
          context.report({ node: node.key, messageId: 'missing', data: { what: 'method', name } });
        }
      },
    };
  },
};

module.exports = { requireJsDoc };
