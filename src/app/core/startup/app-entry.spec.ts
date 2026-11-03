import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEntry } from './app-entry';
import { AppReadiness } from './app-readiness';
import { EntryPolicy, FIRST_ENTRY_MS, REPEAT_ENTRY_MS } from './entry-policy';

describe('AppEntry', () => {
  let resolveReady: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="luma-entry" class="app-entry"></div>';
    const ready = new Promise<void>((resolve) => (resolveReady = resolve));
    TestBed.configureTestingModule({
      providers: [
        { provide: AppReadiness, useValue: { ready } },
        { provide: EntryPolicy, useValue: { maxDurationMs: () => REPEAT_ENTRY_MS } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  const entry = (): HTMLElement | null => document.getElementById('luma-entry');

  it('plays with the cap as its duration and leaves as soon as the app is ready', async () => {
    TestBed.inject(AppEntry).start();
    expect(entry()?.classList).toContain('app-entry--play');
    expect(entry()?.style.getPropertyValue('--entry-duration')).toBe(`${REPEAT_ENTRY_MS}ms`);

    resolveReady();
    // jsdom has no --duration-normal, so the fade-out timer is immediate.
    await vi.advanceTimersByTimeAsync(0);
    expect(entry()).toBeNull();
  });

  it('never outlasts the cap when the app is slow, and a tap skips it', async () => {
    TestBed.inject(AppEntry).start();
    await vi.advanceTimersByTimeAsync(REPEAT_ENTRY_MS - 1);
    expect(entry()?.classList).not.toContain('app-entry--leave');
    entry()?.dispatchEvent(new Event('pointerdown'));
    expect(entry()?.classList).toContain('app-entry--leave');
  });

  it('does nothing when the page has no entry (warm start, tests)', () => {
    document.body.innerHTML = '';
    expect(() => TestBed.inject(AppEntry).start()).not.toThrow();
  });
});

describe('EntryPolicy', () => {
  beforeEach(() => localStorage.clear());

  it('allows 1.8 s the first time and 0.9 s afterwards', () => {
    const policy = new EntryPolicy();
    expect(policy.maxDurationMs()).toBe(FIRST_ENTRY_MS);
    expect(policy.maxDurationMs()).toBe(REPEAT_ENTRY_MS);
  });
});
