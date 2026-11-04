import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { Residence } from '@shared/geo/residence';
import { ResidenceCatalog } from '@shared/geo/residence-catalog';
import { SignupCompletion } from '../../signup/signup-completion';
import { SignupDraftStore } from '../../signup/signup-draft.store';
import { RegisterPage } from './register.page';

/** What the RegisterPage (stepped sign-up) specs share: their mocks, set-up and helpers. */
export function registerPageHarness() {
  const auth = { signUp: vi.fn() };
  const completion = { hold: vi.fn() };
  const catalog = { load: vi.fn().mockResolvedValue(true), departments: () => [], search: () => [], municipality: () => null };
  const pasto = Residence.of('Nariño', 'Pasto', '52001');

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        RegisterPage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: SignupCompletion, useValue: completion },
        { provide: ResidenceCatalog, useValue: catalog },
      ],
    });
    TestBed.inject(SignupDraftStore).reset();
  });

  async function render() {
    const fixture = TestBed.createComponent(RegisterPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const type = async (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle();
    };
    const click = async (selector: string) => {
      el.querySelector<HTMLElement>(selector)!.click();
      await settle();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
    };
    const title = () => el.querySelector('#signup-step-title')?.textContent?.trim();
    return { el, type, click, submit, settle, title };
  }
  const h = {
    auth,
    completion,
    catalog,
    pasto,
    render,
  };
  return h;
}
