import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@design-system/toast/toast.service';
import { ProfileRepository } from '@shared/profile/profile.repository';
import { DisplayNameField } from './display-name-field';

const ES = {
  profile: {
    displayName: {
      label: 'Nombre visible',
      placeholder: 'Cómo te verán en tus reseñas',
      hint: '{{count}}/{{max}}',
      save: 'Guardar',
      saved: 'Nombre guardado',
    },
    errors: { displayNameSave: 'No se pudo guardar.' },
  },
};

describe('DisplayNameField', () => {
  const repo = { getDisplayName: vi.fn(), updateDisplayName: vi.fn() };
  const toasts = { show: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getDisplayName.mockResolvedValue({ data: 'Ana', errorKey: null });
    repo.updateDisplayName.mockResolvedValue({ data: 'Ana M.', errorKey: null });
    TestBed.configureTestingModule({
      imports: [
        DisplayNameField,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        { provide: ProfileRepository, useValue: repo },
        { provide: ToastService, useValue: toasts },
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(DisplayNameField);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, input: el.querySelector('input') as HTMLInputElement };
  }

  const type = async (
    fixture: { detectChanges(): void; whenStable(): Promise<unknown> },
    input: HTMLInputElement,
    text: string,
  ) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('loads the current name with a 40-character limit and counter', async () => {
    const { el, input } = await render();

    expect(input.value).toBe('Ana');
    expect(input.getAttribute('maxlength')).toBe('40');
    expect(el.textContent).toContain('3/40');
  });

  it('saves the new name and confirms it', async () => {
    const { fixture, el, input } = await render();
    await type(fixture, input, 'Ana M.');

    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(repo.updateDisplayName).toHaveBeenCalledWith('u1', 'Ana M.');
    expect(toasts.show).toHaveBeenCalledWith({
      messageKey: 'profile.displayName.saved',
      tone: 'success',
    });
  });

  it('keeps the save button disabled while nothing changed', async () => {
    const { el } = await render();

    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the error when saving fails', async () => {
    repo.updateDisplayName.mockResolvedValue({
      data: null,
      errorKey: 'profile.errors.displayNameSave',
    });
    const { fixture, el, input } = await render();
    await type(fixture, input, 'Otro');

    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo guardar.');
  });
});
