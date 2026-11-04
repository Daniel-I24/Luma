import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PushRegistration } from '@core/push/push-registration.service';
import { NotificationPreferencesRepository } from '../notification-preferences.repository';
import { NotificationSettings } from './notification-settings';

describe('NotificationSettings', () => {
  const repo = { get: vi.fn(), set: vi.fn() };
  const permission = signal<string>('prompt');
  const problem = signal<string | null>(null);
  const push = { permission, problem, enable: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    permission.set('prompt');
    problem.set(null);
    repo.get.mockResolvedValue({ data: { orders: true, promotions: false }, errorKey: null });
    TestBed.configureTestingModule({
      imports: [NotificationSettings, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        { provide: NotificationPreferencesRepository, useValue: repo },
        { provide: PushRegistration, useValue: push },
      ],
    });
  });

  const render = async () => {
    const fixture = TestBed.createComponent(NotificationSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const switches = fixture.nativeElement.querySelectorAll('input[role="switch"]') as NodeListOf<HTMLInputElement>;
    const [orders, promotions] = switches;
    if (!orders || !promotions) throw new Error('both switches are rendered');
    return { fixture, orders, promotions };
  };

  it('promotions start off; turning them on saves and asks the phone for permission', async () => {
    repo.set.mockResolvedValue({ data: true, errorKey: null });
    const { fixture, orders, promotions } = await render();
    expect([orders.checked, promotions.checked]).toEqual([true, false]);
    promotions.click();
    await fixture.whenStable();
    expect(repo.set).toHaveBeenCalledWith({ orders: true, promotions: true });
    expect(push.enable).toHaveBeenCalled();
  });

  it('a failed save puts the switch back and says so', async () => {
    repo.set.mockResolvedValue({ data: null, errorKey: 'notificationSettings.errors.save' });
    const { fixture, orders } = await render();
    orders.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(orders.checked).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(push.enable).not.toHaveBeenCalled();
  });

  it('without the preferences (migration missing) the switches are disabled', async () => {
    repo.get.mockResolvedValue({ data: null, errorKey: 'notificationSettings.errors.load' });
    const { orders } = await render();
    expect(orders.disabled).toBe(true);
  });

  it('offers the permission button only while the phone has not answered', async () => {
    const { fixture } = await render();
    // Only the permission button (the test notification moved to the admin panel in round 8).
    expect(fixture.nativeElement.querySelectorAll('app-luma-button').length).toBe(1);
    permission.set('unavailable');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-luma-button').length).toBe(0);
  });

  it('explains each push problem and offers a retry only when it can help', async () => {
    const { fixture } = await render();
    const shown = (): string => fixture.nativeElement.querySelector('[role="status"]')?.textContent ?? '';
    const buttons = (): number => fixture.nativeElement.querySelectorAll('app-luma-button').length;
    for (const [value, key, retry] of [
      ['denied', 'denied', 0], ['not_configured', 'notConfigured', 0],
      ['registration_failed', 'registrationFailed', 1], ['token_save_failed', 'tokenSaveFailed', 1],
    ] as const) {
      problem.set(value);
      fixture.detectChanges();
      expect(shown()).toContain(`notificationSettings.phone.problem.${key}`);
      expect(buttons()).toBe(retry);
    }
  });
});
