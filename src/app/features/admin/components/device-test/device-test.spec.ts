import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '@design-system';
import { PushRegistration } from '@core/push/push-registration.service';
import { NotificationPreferencesRepository } from '@shared/notifications/notification-preferences.repository';
import { NotificationSettings } from '@shared/notifications/notification-settings/notification-settings';
import { PushHealthRepository } from '../../services/push-health.repository';
import { DeviceTest } from './device-test';

describe('The test notification is an admin tool', () => {
  const repo = { sendTest: vi.fn(), get: vi.fn().mockResolvedValue({ data: { orders: true, promotions: false }, errorKey: null }) };
  const toast = { show: vi.fn() };
  const health = { read: vi.fn().mockResolvedValue(null) };
  const translations = TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } });

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [DeviceTest, NotificationSettings, translations],
      providers: [
        { provide: NotificationPreferencesRepository, useValue: repo },
        { provide: ToastService, useValue: toast },
        { provide: PushHealthRepository, useValue: health },
        { provide: PushRegistration, useValue: { permission: () => 'granted', problem: () => null, enable: vi.fn() } },
      ],
    });
  });

  it('"Probar mi dispositivo" sends the test notice and says so', async () => {
    repo.sendTest.mockResolvedValue({ data: true, errorKey: null });
    const fixture = TestBed.createComponent(DeviceTest);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await vi.waitFor(() => expect(toast.show).toHaveBeenCalledWith({ messageKey: 'notificationSettings.test.sent', tone: 'success' }));
  });

  it('says so when this account has no phone linked', async () => {
    repo.sendTest.mockResolvedValue({ data: false, errorKey: null });
    const fixture = TestBed.createComponent(DeviceTest);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await vi.waitFor(() => expect(toast.show).toHaveBeenCalledWith({ messageKey: 'notificationSettings.test.noToken', tone: 'error' }));
  });

  it.each([
    [404, 'notDeployed'],
    [401, 'badSecret'],
    [503, 'noAccount'],
    [200, 'working'],
    [500, 'other'],
    [null, 'noCalls'],
  ])('the last answer of the push server (%s) has its own message', async (status, key) => {
    health.read.mockResolvedValueOnce({ status, body: null, tokens: 2, unsent: 3 });
    const fixture = TestBed.createComponent(DeviceTest);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(`admin.operations.pushHealth.${key}`);
  });

  it('Perfil → Notificaciones no longer offers a test notification', async () => {
    const fixture = TestBed.createComponent(NotificationSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('notificationSettings.test.send');
    expect(repo.sendTest).not.toHaveBeenCalled();
  });
});
