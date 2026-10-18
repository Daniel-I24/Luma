import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import type { SignupField } from '../../signup-draft';
import { SignupDraftStore } from '../../signup-draft.store';

type ConsentField = Extract<SignupField, 'acceptedTerms' | 'acceptedPrivacy' | 'isAdult'>;

const CONSENTS: readonly { field: ConsentField; link: string | null }[] = [
  { field: 'acceptedTerms', link: '/legal/terms' },
  { field: 'acceptedPrivacy', link: '/legal/privacy' },
  { field: 'isAdult', link: null },
];

/** Step 4 — terms, privacy policy (data processing, Ley 1581) and legal age. */
@Component({
  selector: 'app-consent-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink],
  template: `
    <div *transloco="let t" class="flex flex-col gap-3">
      @for (consent of consents; track consent.field) {
        <div class="flex flex-col gap-1">
          <label class="flex min-h-11 cursor-pointer items-start gap-3 text-body text-fg">
            <input
              type="checkbox"
              class="mt-0.5 size-5 shrink-0 accent-primary"
              [id]="'signup-' + consent.field"
              [checked]="store.draft()[consent.field]"
              [attr.aria-invalid]="store.errors()[consent.field] ? 'true' : null"
              [attr.aria-describedby]="
                store.errors()[consent.field] ? 'signup-' + consent.field + '-error' : null
              "
              (change)="store.update(consent.field, !store.draft()[consent.field])"
            />
            <span>{{ t('auth.signup.consent.' + consent.field) }}</span>
          </label>
          @if (consent.link) {
            <a
              class="ml-8 inline-flex min-h-11 items-center self-start text-body-sm font-semibold text-fg-brand"
              [routerLink]="consent.link"
            >
              {{ t('auth.signup.consent.' + consent.field + 'Link') }}
            </a>
          }
          @if (store.errors()[consent.field]; as error) {
            <p
              [id]="'signup-' + consent.field + '-error'"
              class="m-0 ml-8 text-body-sm text-danger-fg"
              role="alert"
            >
              {{ t(error) }}
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class ConsentStep {
  protected readonly store = inject(SignupDraftStore);
  protected readonly consents = CONSENTS;
}
