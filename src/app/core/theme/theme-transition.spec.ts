import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_TRANSITION_CLASS, ThemeService } from './theme.service';

describe('ThemeService — colour transition', () => {
  const html = document.documentElement;
  const hasClass = () => html.classList.contains(THEME_TRANSITION_CLASS);

  function setup(): ThemeService {
    TestBed.configureTestingModule({
      providers: [ThemeService, { provide: PLATFORM_ID, useValue: 'browser' }],
    });
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    html.style.setProperty('--duration-theme', '200ms');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
    html.removeAttribute('data-theme');
    html.style.removeProperty('--duration-theme');
    html.classList.remove(THEME_TRANSITION_CLASS);
    TestBed.resetTestingModule();
  });

  it('adds the class when the user changes theme and removes it after the token duration', () => {
    const service = setup();

    service.setTheme('midnight');
    expect(hasClass()).toBe(true);

    vi.advanceTimersByTime(199);
    expect(hasClass()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hasClass()).toBe(false);
  });

  it('never transitions on startup, even with a stored theme', () => {
    localStorage.setItem('luma-theme', 'sunset');
    setup();
    TestBed.tick();

    expect(html.getAttribute('data-theme')).toBe('sunset');
    expect(hasClass()).toBe(false);
  });

  it('skips the transition when re-selecting the active theme', () => {
    setup().setTheme('indigo');

    expect(hasClass()).toBe(false);
  });

  it('skips the transition under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));

    setup().setTheme('pearl');

    expect(hasClass()).toBe(false);
  });
});
