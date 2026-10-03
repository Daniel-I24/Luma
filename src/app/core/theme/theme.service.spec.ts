import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { describe, it, expect, afterEach } from 'vitest';
import { ThemeService } from './theme.service';
import type { Theme } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  const setupTestBed = (platformId = 'browser') => {
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    service = TestBed.inject(ThemeService);
  };

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  it('defaults to the indigo theme', () => {
    setupTestBed();
    expect(service.theme()).toBe('indigo');
  });

  it('does not set data-theme attribute for the default indigo theme', () => {
    setupTestBed();
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('applies data-theme attribute when a non-default theme is set', () => {
    setupTestBed();
    service.setTheme('midnight');
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight');
  });

  it('removes data-theme when switching back to indigo', () => {
    setupTestBed();
    service.setTheme('midnight');
    TestBed.flushEffects();
    service.setTheme('indigo');
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('persists the theme to localStorage', () => {
    setupTestBed();
    service.setTheme('sunset');
    expect(localStorage.getItem('luma-theme')).toBe('sunset');
  });

  it('restores a persisted theme from localStorage', () => {
    localStorage.setItem('luma-theme', 'pearl');
    setupTestBed();
    expect(service.theme()).toBe('pearl');
  });

  it('falls back to indigo for an invalid stored value', () => {
    localStorage.setItem('luma-theme', 'invalid-theme');
    setupTestBed();
    expect(service.theme()).toBe('indigo');
  });

  it('updates the signal when setTheme is called', () => {
    setupTestBed();
    const themes: Theme[] = ['midnight', 'pearl', 'sunset', 'indigo'];
    for (const theme of themes) {
      service.setTheme(theme);
      expect(service.theme()).toBe(theme);
    }
  });
});
