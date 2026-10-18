import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SignupDraftStore } from './signup-draft.store';

describe('SignupDraftStore', () => {
  let store: SignupDraftStore;

  beforeEach(() => {
    store = TestBed.inject(SignupDraftStore);
    store.reset();
  });

  it('stays on a step until it is valid and returns the first invalid field', () => {
    expect(store.next()).toBe('accountType');
    expect(store.step()).toBe('accountType');

    store.update('accountType', 'business_owner');
    expect(store.next()).toBeNull();
    expect(store.step()).toBe('personal');
    expect(store.next()).toBe('fullName');
    expect(store.errors()).toEqual({
      fullName: 'auth.signup.validation.fullName',
      phone: 'auth.signup.validation.phoneRequired',
    });
  });

  it('re-checks a field with an error as it is edited', () => {
    store.update('accountType', 'customer');
    store.next();
    store.next();

    store.update('fullName', 'Ana');
    expect(store.errors().fullName).toBeUndefined();
  });

  it('keeps everything typed when going back and forth', () => {
    store.update('accountType', 'customer');
    store.next();
    store.update('fullName', 'Ana Pérez');
    store.next();
    store.update('email', 'ana@example.com');

    expect(store.back()).toBe(true);
    expect(store.back()).toBe(true);
    expect(store.back()).toBe(false);
    expect(store.draft()).toMatchObject({
      accountType: 'customer',
      fullName: 'Ana Pérez',
      email: 'ana@example.com',
    });
  });

  it('does not move past the last step and forgets everything on reset', () => {
    store.update('accountType', 'customer');
    store.update('fullName', 'Ana');
    store.update('email', 'ana@example.com');
    store.update('password', 'tamal2024');
    store.update('acceptedTerms', true);
    store.update('acceptedPrivacy', true);
    store.update('isAdult', true);
    for (let i = 0; i < 4; i++) store.next();

    expect(store.isLast()).toBe(true);
    expect(store.next()).toBeNull();
    expect(store.index()).toBe(3);

    store.reset();
    expect(store.index()).toBe(0);
    expect(store.draft().password).toBe('');
  });
});
