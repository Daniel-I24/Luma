import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupDraftStore } from '../../signup-draft.store';
import { PhotoStep } from './photo-step';

function choose(el: HTMLElement, file: File): void {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('PhotoStep', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({
      imports: [PhotoStep, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    });
    TestBed.inject(SignupDraftStore).reset();
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps a valid photo in the draft and shows the consent checkbox', () => {
    const fixture = TestBed.createComponent(PhotoStep);
    fixture.detectChanges();
    const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    choose(fixture.nativeElement, photo);
    fixture.detectChanges();
    expect(TestBed.inject(SignupDraftStore).draft().avatar).toBe(photo);
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:preview');
    expect(fixture.nativeElement.querySelector('#signup-avatarConsent')).not.toBeNull();
  });

  it('refuses files that are not images, and removing the photo also drops its consent', () => {
    const fixture = TestBed.createComponent(PhotoStep);
    fixture.detectChanges();
    choose(fixture.nativeElement, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('media.errors.type');

    const store = TestBed.inject(SignupDraftStore);
    choose(fixture.nativeElement, new File(['x'], 'me.png', { type: 'image/png' }));
    store.update('avatarConsent', true);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('app-luma-button button')!.click();
    expect(store.draft().avatar).toBeNull();
    expect(store.draft().avatarConsent).toBe(false);
  });
});
