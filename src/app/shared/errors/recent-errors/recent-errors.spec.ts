import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '@core/errors/error-log';
import { RecentErrors } from './recent-errors';

describe('RecentErrors', () => {
  it('lists the recorded errors and copies them for support', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    TestBed.configureTestingModule({ imports: [RecentErrors, TranslocoTestingModule.forRoot({ langs: { es: {} } })] });
    TestBed.inject(ErrorLog).record(new Error('channel failed'), 'realtime');
    const fixture = TestBed.createComponent(RecentErrors);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('li')?.textContent).toContain('realtime');
    expect(element.querySelector('li')?.textContent).toContain('Error: channel failed');

    (element.querySelector('app-luma-button button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(writeText.mock.calls[0]?.[0]).toContain('[realtime]');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('technicalErrors.copied.ok');
  });
});
