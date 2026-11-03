import { describe, expect, it } from 'vitest';
import { authGuard } from '@core/auth/auth.guard';
import { ownerGuard } from '@shared/account/account.guards';
import { routes } from './app.routes';
import { DEV_ONLY_ROUTES as PROD_DEV_ROUTES } from './dev-routes.prod';

describe('app routes', () => {
  it('shows a not-found page for unknown URLs', () => {
    const last = routes.at(-1);
    expect(last?.path).toBe('**');
    expect(last?.loadComponent).toBeTypeOf('function');
  });

  it('includes the design preview outside production builds', () => {
    // Tests use dev-routes.ts; production builds replace it with dev-routes.prod.ts.
    expect(routes.some((route) => route.path === 'design-preview')).toBe(true);
    expect(PROD_DEV_ROUTES).toEqual([]);
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
