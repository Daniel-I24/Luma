import { describe, expect, it } from 'vitest';
import { authGuard } from '@core/auth/auth.guard';
import { ownerGuard } from '@shared/account/account.guards';
import { routes } from './app.routes';

describe('app routes', () => {
  it('sends unknown URLs to the map', () => {
    expect(routes.at(-1)).toEqual({ path: '**', redirectTo: 'map' });
  });

  it('includes the design preview outside production builds', () => {
    // Tests run in dev mode; the production build drops this route (ngDevMode = false).
    expect(routes.some((route) => route.path === 'design-preview')).toBe(true);
  });

  it('guards Luma Negocios (/owner) for signed-in business owners, outside the customer tabs', () => {
    const owner = routes.find((route) => route.path === 'owner');
    expect(owner?.canActivate).toEqual([authGuard, ownerGuard]);
    expect(owner?.loadChildren).toBeTypeOf('function');
    expect(routes.some((route) => route.children?.some((child) => child.path === 'business'))).toBe(
      false,
    );
  });
});
