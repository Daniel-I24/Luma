import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phone } from '@shared/account/phone';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { Residence } from '@shared/geo/residence';
import { AccountDetailsStore } from './account-details.store';

describe('AccountDetailsStore', () => {
  const session = {
    whenLoaded: vi.fn().mockResolvedValue(undefined),
    profile: vi.fn(),
    saveDetails: vi.fn(),
  };
  const pasto = Residence.of('Nariño', 'Pasto', '52001')!;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [AccountDetailsStore, { provide: SessionProfileStore, useValue: session }] });
  });

  it('fills the form with the current profile', async () => {
    session.profile.mockReturnValue({ fullName: 'Ana Pérez', phone: Phone.parse('3001234567'), residence: pasto });
    const store = TestBed.inject(AccountDetailsStore);
    await store.load();
    expect([store.fullName(), store.phone(), store.residence()]).toEqual(['Ana Pérez', '+57 300 123 4567', pasto]);
  });

  it('checks name, mobile and residence before calling the server', async () => {
    const store = TestBed.inject(AccountDetailsStore);
    store.fullName.set('An');
    expect(await store.save()).toBe(false);
    expect(store.errorKey()).toBe('accountDetails.errors.name');
    store.fullName.set('Ana Pérez');
    store.phone.set('12345');
    expect(await store.save()).toBe(false);
    expect(store.errorKey()).toBe('accountDetails.errors.phone');
    store.phone.set('300 123 4567');
    expect(await store.save()).toBe(false);
    expect(store.errorKey()).toBe('accountDetails.errors.residence');
    expect(session.saveDetails).not.toHaveBeenCalled();
  });

  it('saves a complete form and reports a server refusal', async () => {
    const store = TestBed.inject(AccountDetailsStore);
    store.fullName.set('  Ana Pérez ');
    store.phone.set('300 123 4567');
    store.residence.set(pasto);
    session.saveDetails.mockResolvedValueOnce(null).mockResolvedValueOnce('profile.errors.save');
    expect(await store.save()).toBe(true);
    expect(session.saveDetails).toHaveBeenCalledWith({ fullName: 'Ana Pérez', phone: Phone.parse('3001234567'), residence: pasto });
    expect(await store.save()).toBe(false);
    expect(store.errorKey()).toBe('profile.errors.save');
  });
});
