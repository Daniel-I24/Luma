import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { describe, it, expect, afterEach } from 'vitest';
import { ThemeService } from './theme.service';
import type { Theme } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  const setupTestBed = (platformId = 'browser') => {
    TestBed.configureTestingModule({
      providers: [ThemeService, { provide: PLATFORM_ID, useValue: platformId }],
    });
    service = TestBed.inject(ThemeService);
  };

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  it('defaults to the sky theme', () => {
    setupTestBed();
    expect(service.theme()).toBe('sky');
  });

  it('does not set data-theme attribute for the default sky theme', () => {
    setupTestBed();
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('applies data-theme attribute when a non-default theme is set', () => {
    setupTestBed();
    service.setTheme('night');
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBe('night');
  });

  it('removes data-theme when switching back to sky', () => {
    setupTestBed();
    service.setTheme('night');
    TestBed.flushEffects();
    service.setTheme('sky');
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('persists the theme to localStorage', () => {
    setupTestBed();
    service.setTheme('maize');
    expect(localStorage.getItem('luma-theme')).toBe('maize');
  });

  it('restores a persisted theme from localStorage', () => {
    localStorage.setItem('luma-theme', 'lacquer');
    setupTestBed();
    expect(service.theme()).toBe('lacquer');
  });

  it('falls back to sky for an invalid stored value', () => {
    localStorage.setItem('luma-theme', 'invalid-theme');
    setupTestBed();
    expect(service.theme()).toBe('sky');
  });

  it('updates the signal when setTheme is called', () => {
    setupTestBed();
    const themes: Theme[] = ['night', 'lacquer', 'maize', 'sky'];
    for (const theme of themes) {
      service.setTheme(theme);
      expect(service.theme()).toBe(theme);
    }
  });
});
