// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const luma = require('./eslint/plugin');
const { namingConvention } = require('./eslint/naming');

/** Quality limits required in CI (docs/architecture/patterns.md). */
const QUALITY_RULES = {
  complexity: ['error', 10],
  'max-depth': ['error', 3],
  'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 150, skipBlankLines: false, skipComments: false }],
  '@typescript-eslint/max-params': ['error', { max: 4 }],
  'no-magic-numbers': 'off',
  '@typescript-eslint/no-magic-numbers': [
    'error',
    {
      ignore: [0, 1, -1],
      ignoreEnums: true,
      ignoreNumericLiteralTypes: true,
      ignoreReadonlyClassProperties: true,
      ignoreTypeIndexes: true,
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
    },
  ],
  '@typescript-eslint/explicit-member-accessibility': ['error', { overrides: { constructors: 'no-public' } }],
  '@typescript-eslint/explicit-function-return-type': [
    'error',
    { allowExpressions: true, allowTypedFunctionExpressions: true, allowHigherOrderFunctions: true },
  ],
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/naming-convention': namingConvention,
};

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        // Test helpers outside both tsconfigs (their specs are in tsconfig.spec.json).
        projectService: {
          allowDefaultProject: ['src/testing/click-all.ts', 'src/testing/fake-supabase.ts', 'src/testing/fixed-clock.ts'],
        },
        tsconfigRootDir: __dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      ...QUALITY_RULES,
    },
  },
  {
    files: ['src/app/**/*.ts'],
    plugins: { luma },
    rules: { 'luma/layer-boundaries': 'error', 'luma/no-loose-functions': 'error' },
  },
  {
    // Specs describe behaviour in long, literal scenarios: size and literal
    // limits do not apply; types and naming still do.
    files: ['**/*.spec.ts', 'src/testing/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'max-depth': 'off',
      complexity: 'off',
      'luma/no-loose-functions': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
