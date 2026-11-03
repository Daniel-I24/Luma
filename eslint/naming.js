// @ts-check
/**
 * Naming: camelCase members and functions, PascalCase types and classes,
 * UPPER_SNAKE constants. Object-literal and type properties may mirror
 * external names (database columns, HTTP headers, translation params), so
 * only their own code-facing identifiers are checked.
 */
const namingConvention = [
  'error',
  { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: 'import', format: null },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
  // Module constants are UPPER_SNAKE; camelCase/PascalCase for functions,
  // Angular factories, schemas and component-like values.
  { selector: 'variable', modifiers: ['const'], format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
  { selector: 'variable', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: 'classProperty', modifiers: ['static', 'readonly'], format: ['camelCase', 'UPPER_CASE'] },
  { selector: 'classProperty', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: ['objectLiteralProperty', 'typeProperty', 'objectLiteralMethod'], format: null },
];

module.exports = { namingConvention };
