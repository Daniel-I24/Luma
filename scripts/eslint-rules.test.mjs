import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { RuleTester } = require('eslint');
const tsParser = require('typescript-eslint').parser;
const { rules } = require('../eslint/plugin.js');

const APP = join(fileURLToPath(new URL('..', import.meta.url)), 'src', 'app');
const at = (...parts) => join(APP, ...parts);
const tester = new RuleTester({ languageOptions: { parser: tsParser } });

test('layer-boundaries: features → shared → core, no feature-to-feature imports', () => {
  tester.run('layer-boundaries', rules['layer-boundaries'], {
    valid: [
      { filename: at('features', 'map', 'map.page.ts'), code: "import { X } from '@shared/geo/haversine';" },
      { filename: at('features', 'map', 'a', 'b.ts'), code: "import { X } from '../map.page';" },
      { filename: at('shared', 'geo', 'x.ts'), code: "import { X } from '@core/config/units';" },
      { filename: at('design-system', 'x.ts'), code: "import { X } from '@core/theme/theme.service';" },
    ],
    invalid: [
      { filename: at('features', 'map', 'x.ts'), code: "import { X } from '@features/cart/cart.page';", errors: [{ messageId: 'feature' }] },
      { filename: at('features', 'map', 'a', 'x.ts'), code: "import { X } from '../../cart/cart.page';", errors: [{ messageId: 'feature' }] },
      { filename: at('core', 'x.ts'), code: "import { X } from '@shared/geo/haversine';", errors: [{ messageId: 'layer' }] },
      { filename: at('shared', 'x.ts'), code: "import { X } from '@features/map/map.page';", errors: [{ messageId: 'layer' }] },
    ],
  });
});

test('no-loose-functions: only Angular *Fn factories and provide* functions may be exported', () => {
  tester.run('no-loose-functions', rules['no-loose-functions'], {
    valid: [
      'export class Money { static of(): number { return 1; } }',
      'export const guard: CanActivateFn = () => true;',
      'export function provideLuma(): unknown { return []; }',
      'function helper(): number { return 1; }',
      'export const LIMIT = 5;',
    ],
    invalid: [
      { code: 'export function total(): number { return 1; }', errors: [{ messageId: 'loose' }] },
      { code: 'export const total = (): number => 1;', errors: [{ messageId: 'loose' }] },
    ],
  });
});

test('require-jsdoc: classes and public methods are documented', () => {
  tester.run('require-jsdoc', rules['require-jsdoc'], {
    valid: [
      `/** Money. */
export class Money {
  /** Cents. */
  public cents(): number { return 1; }
  private helper(): void {}
}`,
      `/** A. */
@Component({})
export class A {
  /** @inheritdoc */
  public run(): void {}
}`,
    ],
    invalid: [
      { code: 'export class Money {}', errors: [{ messageId: 'missing' }] },
      {
        code: `/** M. */
class M {
  public run(): void {}
}`,
        errors: [{ messageId: 'missing' }],
      },
    ],
  });
});
