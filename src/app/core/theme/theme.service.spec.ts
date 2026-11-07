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

  it('defaults to the ciruela theme', () => {
    setupTestBed();
    expect(service.theme()).toBe('ciruela');
  });

  it('does not set data-theme attribute for the default ciruela theme', () => {
    setupTestBed();
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('applies data-theme attribute when a non-default theme is set', () => {
    setupTestBed();
    service.setTheme('crema');
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBe('crema');
  });

  it('removes data-theme when switching back to ciruela', () => {
    setupTestBed();
    service.setTheme('crema');
    TestBed.flushEffects();
    service.setTheme('ciruela');
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('persists the theme to localStorage', () => {
    setupTestBed();
    service.setTheme('crema');
    expect(localStorage.getItem('luma-theme')).toBe('crema');
  });

  it('restores a persisted theme from localStorage', () => {
    localStorage.setItem('luma-theme', 'crema');
    setupTestBed();
    expect(service.theme()).toBe('crema');
  });

  it('falls back to ciruela for an invalid stored value', () => {
    localStorage.setItem('luma-theme', 'invalid-theme');
    setupTestBed();
    expect(service.theme()).toBe('ciruela');
  });

  it('updates the signal when setTheme is called', () => {
    setupTestBed();
    const themes: Theme[] = ['crema', 'crema', 'crema', 'ciruela'];
    for (const theme of themes) {
      service.setTheme(theme);
      expect(service.theme()).toBe(theme);
    }
  });
});
