import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { THEMES, ThemeService } from './theme.service';

describe('ThemeService — preferences saved before there were two themes', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  const open = (stored: string | null): ThemeService => {
    if (stored) localStorage.setItem('luma-theme', stored);
    TestBed.configureTestingModule({ providers: [ThemeService, { provide: PLATFORM_ID, useValue: 'browser' }] });
    return TestBed.inject(ThemeService);
  };

  it('offers exactly two themes', () => {
    expect(THEMES).toEqual(['ciruela', 'crema']);
  });

  it.each(['night', 'midnight', 'indigo'])('the dark %s becomes Ciruela, and stays saved', (stored) => {
    expect(open(stored).theme()).toBe('ciruela');
    expect(localStorage.getItem('luma-theme')).toBe('ciruela');
  });

  it.each(['sky', 'lacquer', 'maize', 'pearl', 'sunset'])('the light %s becomes Crema, and stays saved', (stored) => {
    expect(open(stored).theme()).toBe('crema');
    expect(localStorage.getItem('luma-theme')).toBe('crema');
  });

  it('nothing saved, or something unknown: the main theme, Ciruela', () => {
    expect(open(null).theme()).toBe('ciruela');
    TestBed.resetTestingModule();
    expect(open('unknown').theme()).toBe('ciruela');
  });

  it('a current preference is kept', () => {
    expect(open('crema').theme()).toBe('crema');
  });
});
