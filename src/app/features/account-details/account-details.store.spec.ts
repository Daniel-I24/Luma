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

  it('fills the form with the current profile, without showing errors', async () => {
    session.profile.mockReturnValue({ fullName: 'Ana Pérez', phone: Phone.parse('3001234567'), residence: pasto });
    const store = TestBed.inject(AccountDetailsStore);
    await store.load();
    expect([store.name.value(), store.phone.value(), store.residence()]).toEqual(['Ana Pérez', '+57 300 123 4567', pasto]);
    expect([store.name.error(), store.phone.error()]).toEqual([null, null]);
  });

  it('a name with numbers (the reported bug) or emojis is refused under the field, never sent', async () => {
    const store = TestBed.inject(AccountDetailsStore);
    store.phone.input('300 123 4567');
    store.residence.set(pasto);
    for (const name of ['Ana 3', 'R2D2', 'Ana 😀', 'A']) {
      store.name.input(name);
      expect(await store.save()).toBe(false);
      expect(store.name.error()).toBe('validation.personName');
    }
    expect(session.saveDetails).not.toHaveBeenCalled();
  });

  it('checks each field: empty, landline, residence', async () => {
    const store = TestBed.inject(AccountDetailsStore);
    expect(await store.save()).toBe(false);
    expect([store.name.error(), store.phone.error()]).toEqual(['validation.required', 'validation.required']);
    store.name.input('María José');
    store.phone.input('601 234 5678');
    expect(await store.save()).toBe(false);
    expect([store.name.error(), store.phone.error()]).toEqual([null, 'validation.mobilePhone']);
    store.phone.input('300 123 4567');
    expect(await store.save()).toBe(false);
    expect(store.errorKey()).toBe('accountDetails.errors.residence');
    expect(session.saveDetails).not.toHaveBeenCalled();
  });

  it('shows an error only after leaving the field', () => {
    const store = TestBed.inject(AccountDetailsStore);
    store.name.input('Ana 3');
    expect(store.name.error()).toBeNull();
    store.name.blur();
    expect(store.name.error()).toBe('validation.personName');
    store.name.input("Ana O'Connor");
    expect(store.name.error()).toBeNull();
  });

  it('saves the cleaned values and reports a server refusal', async () => {
    const store = TestBed.inject(AccountDetailsStore);
    store.name.input('  Ana   Pérez ');
    store.phone.input('300 123 4567');
    store.residence.set(pasto);
    session.saveDetails.mockResolvedValueOnce(null).mockResolvedValueOnce('profile.errors.save');
    expect(await store.save()).toBe(true);
    expect(session.saveDetails).toHaveBeenCalledWith({ fullName: 'Ana Pérez', phone: Phone.parse('3001234567'), residence: pasto });
    expect(await store.save()).toBe(false);
    expect(store.errorKey()).toBe('profile.errors.save');
  });
});
