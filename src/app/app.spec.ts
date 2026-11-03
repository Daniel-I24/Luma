import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, it, expect, beforeEach } from 'vitest';
import { authGuard } from '@core/auth/auth.guard';
import { ownerGuard } from '@shared/account/account.guards';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('creates the app component', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});

describe('app routes', () => {
  it('shows a not-found page for unknown URLs', () => {
    const last = routes.at(-1);
    expect(last?.path).toBe('**');
    expect(last?.loadComponent).toBeTypeOf('function');
  });

  it('guards Luma Negocios (/owner) for signed-in business owners, outside the customer tabs', () => {
    const owner = routes.find((route) => route.path === 'owner');
    expect(owner?.canActivate).toEqual([authGuard, ownerGuard]);
    expect(owner?.loadChildren).toBeTypeOf('function');
    expect(routes.some((route) => route.children?.some((child) => child.path === 'business'))).toBe(false);
  });
});
