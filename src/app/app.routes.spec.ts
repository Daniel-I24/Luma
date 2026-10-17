import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('app routes', () => {
  it('sends unknown URLs to the map', () => {
    expect(routes.at(-1)).toEqual({ path: '**', redirectTo: 'map' });
  });

  it('includes the design preview outside production builds', () => {
    // Tests run in dev mode; the production build drops this route (ngDevMode = false).
    expect(routes.some((route) => route.path === 'design-preview')).toBe(true);
  });
});
