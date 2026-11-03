// @ts-check
/**
 * luma/no-loose-functions — domain behaviour lives in classes (value
 * objects, services, repositories, state machines), so a module does not
 * export free functions. Allowed: the functional factories Angular requires
 * as thin adapters — values typed as an Angular `*Fn` (CanActivateFn,
 * ResolveFn, HttpInterceptorFn, …) and `provide*` provider functions.
 */

const isFunction = (node) =>
  !!node && (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression');

/** True for `export const guard: CanActivateFn = …`. */
function isAngularFactory(declarator) {
  const annotation = declarator.id.typeAnnotation?.typeAnnotation;
  const name = annotation?.type === 'TSTypeReference' ? annotation.typeName.name : '';
  return typeof name === 'string' && /Fn$/.test(name);
}

/** @type {import('eslint').Rule.RuleModule} */
const noLooseFunctions = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Exported behaviour lives in classes, not free functions.' },
    messages: {
      loose:
        "Exported function '{{name}}': move it to a class (static methods on an immutable class, or an injectable service).",
    },
    schema: [],
  },
  create(context) {
    const report = (node, name) => {
      if (!/^provide[A-Z]/.test(name)) context.report({ node, messageId: 'loose', data: { name } });
    };
    return {
      'Program > ExportNamedDeclaration > FunctionDeclaration'(node) {
        report(node, node.id?.name ?? 'default');
      },
      'Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(node) {
        if (isFunction(node.init) && !isAngularFactory(node)) report(node, node.id.name);
      },
    };
  },
};

module.exports = { noLooseFunctions };
