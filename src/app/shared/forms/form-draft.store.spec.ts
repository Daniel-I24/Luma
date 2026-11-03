import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { UserDataRegistry } from '@core/auth/user-data-registry';
import { DRAFT_MAX_AGE_MS, FormDraftStore } from './form-draft.store';
import { type HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

interface Promo {
  title: string;
  discount: string;
  imageUrl: string | null;
}

describe('FormDraftStore', () => {
  const user = signal<{ id: string } | null>({ id: 'owner-1' });
  const saved: Promo = { title: '', discount: '', imageUrl: null };

  beforeEach(() => {
    localStorage.clear();
    user.set({ id: 'owner-1' });
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user } }] });
  });
  afterEach(() => localStorage.clear());

  function open() {
    const value = signal<Promo>(saved);
    const draft = runInInjectionContext(TestBed.inject(Injector), () => TestBed.inject(FormDraftStore).attach(value));
    draft.load('promotion.b1.new', saved);
    TestBed.tick();
    return { value, draft };
  }

  it('keeps what was typed on the device and offers it back ("Recuperamos tu borrador")', () => {
    const first = open();
    first.value.set({ ...saved, title: '2x1 en hamburguesas' });
    TestBed.tick();
    expect(first.draft.dirty()).toBe(true);
    expect(localStorage.getItem('luma.draft.owner-1.promotion.b1.new')).toContain('2x1 en hamburguesas');

    const again = open();
    expect(again.value().title).toBe('2x1 en hamburguesas');
    expect(again.draft.restored()).toBe(true);
  });

  it('forgets the draft once saved, and "Descartar" returns to the saved value', () => {
    const form = open();
    form.value.set({ ...saved, title: 'Combo' });
    TestBed.tick();
    form.draft.saved();
    expect(form.draft.dirty()).toBe(false);
    expect(localStorage.getItem('luma.draft.owner-1.promotion.b1.new')).toBeNull();

    form.value.set({ ...saved, title: 'Otro' });
    TestBed.tick();
    form.draft.discard();
    expect(form.value().title).toBe('Combo');
  });

  it('is per user: another account on the device never sees it, and sign-out wipes it', () => {
    const form = open();
    form.value.set({ ...saved, title: 'Secreto' });
    TestBed.tick();
    user.set({ id: 'owner-2' });
    expect(open().value().title).toBe('');

    TestBed.inject(UserDataRegistry).clearAll();
    expect(Object.keys(localStorage).filter((k) => k.startsWith('luma.draft.'))).toEqual([]);
  });

  it('ignores drafts that are too old or of another shape', () => {
    const store = TestBed.inject(FormDraftStore);
    localStorage.setItem('luma.draft.owner-1.promotion.b1.new', JSON.stringify({ at: Date.now() - DRAFT_MAX_AGE_MS - 1, value: { ...saved, title: 'viejo' } }));
    expect(store.read('promotion.b1.new')).toBeNull();
    localStorage.setItem('luma.draft.owner-1.promotion.b1.new', JSON.stringify({ at: Date.now(), value: { other: 1 } }));
    expect(open().draft.restored()).toBe(false);
  });
});

describe('unsavedChangesGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [provideRouter([])],
    });
  });
  const run = (screen: HasUnsavedChanges) =>
    TestBed.runInInjectionContext(() => unsavedChangesGuard(screen, {} as never, {} as never, {} as never));

  it('asks only when there are unsaved changes', () => {
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    TestBed.inject(Router);
    expect(run({ hasUnsavedChanges: () => false })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(run({ hasUnsavedChanges: () => true })).toBe(false);
    expect(confirm).toHaveBeenCalledWith('forms.draft.leaveConfirm');
    confirm.mockRestore();
  });
});
