import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ThemeService } from '@core/theme/theme.service';
import type { Theme } from '@core/theme/theme.service';
import { NativeStatusBar } from './native-device';
import { StatusBarThemeService } from './status-bar-theme.service';

async function setup(native: boolean, initialTheme: Theme = 'crema') {
  const theme = signal<Theme>(initialTheme);
  const statusBar = {
    isAvailable: () => Promise.resolve(native),
    overlayWebView: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: NativeStatusBar, useValue: statusBar },
      { provide: ThemeService, useValue: { theme } },
    ],
  });
  TestBed.inject(StatusBarThemeService);
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.flushEffects();
  return { theme, statusBar };
}

describe('StatusBarThemeService', () => {
  it('does nothing on the web', async () => {
    const { statusBar } = await setup(false);

    expect(statusBar.overlayWebView).not.toHaveBeenCalled();
    expect(statusBar.setContent).not.toHaveBeenCalled();
  });

  it('draws under the status bar with dark icons on light themes', async () => {
    const { statusBar } = await setup(true, 'crema');

    expect(statusBar.overlayWebView).toHaveBeenCalledOnce();
    expect(statusBar.setContent).toHaveBeenCalledWith('dark-content');
  });

  it('switches to light icons for the Midnight theme', async () => {
    const { statusBar, theme } = await setup(true);

    theme.set('ciruela');
    TestBed.flushEffects();

    expect(statusBar.setContent).toHaveBeenLastCalledWith('light-content');
  });

  it('never throws when the plugin fails', async () => {
    const { statusBar, theme } = await setup(true);
    statusBar.setContent.mockRejectedValue(new Error('not implemented'));

    theme.set('crema');
    TestBed.flushEffects();
    await Promise.resolve();

    expect(statusBar.setContent).toHaveBeenLastCalledWith('dark-content');
  });
});
