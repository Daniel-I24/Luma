import { describe, expect, it } from 'vitest';
import { authGuard } from '@core/auth/auth.guard';
import { ownerGuard } from '@shared/account/account.guards';
import { routes } from './app.routes';

describe('app routes', () => {
  it('shows a not-found page for unknown URLs', () => {
    const last = routes.at(-1);
    expect(last?.path).toBe('**');
    expect(last?.loadComponent).toBeTypeOf('function');
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
