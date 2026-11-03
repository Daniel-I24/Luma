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
  const push = { permission, enable: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    permission.set('prompt');
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
    return { fixture, orders: switches[0], promotions: switches[1] };
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
    // The permission button plus "Enviar notificación de prueba", always there.
    expect(fixture.nativeElement.querySelectorAll('app-luma-button').length).toBe(2);
    permission.set('unavailable');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-luma-button').length).toBe(1);
  });
});
