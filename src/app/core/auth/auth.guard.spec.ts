import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';
import { guestGuard } from './guest.guard';

interface AuthStub {
  ready: Promise<void>;
  user: WritableSignal<{ id: string } | null>;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function run(guard: CanActivateFn, auth: AuthStub): Promise<unknown> {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  return TestBed.runInInjectionContext(() =>
    Promise.resolve(guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)),
  );
}

function serialize(result: unknown): string {
  return TestBed.inject(Router).serializeUrl(result as UrlTree);
}

describe('authGuard', () => {
  it('waits for the session restore before deciding', async () => {
    const ready = deferred();
    const auth: AuthStub = { ready: ready.promise, user: signal(null) };
    const result = run(authGuard, auth);

    auth.user.set({ id: 'user-1' });
    ready.resolve();

    expect(await result).toBe(true);
  });

  it('redirects to /auth/login when there is no session', async () => {
    const auth: AuthStub = { ready: Promise.resolve(), user: signal(null) };

    const result = await run(authGuard, auth);

    expect(serialize(result)).toBe('/auth/login');
  });
});

describe('guestGuard', () => {
  it('allows access when there is no session', async () => {
    const auth: AuthStub = { ready: Promise.resolve(), user: signal(null) };

    expect(await run(guestGuard, auth)).toBe(true);
  });

  it('redirects to /map when a session exists', async () => {
    const auth: AuthStub = {
      ready: Promise.resolve(),
      user: signal({ id: 'user-1' }),
    };

    const result = await run(guestGuard, auth);

    expect(serialize(result)).toBe('/map');
  });

  it('waits for the session restore before deciding', async () => {
    const ready = deferred();
    const auth: AuthStub = { ready: ready.promise, user: signal(null) };
    const result = run(guestGuard, auth);

    auth.user.set({ id: 'user-1' });
    ready.resolve();

    expect(serialize(await result)).toBe('/map');
  });
});
