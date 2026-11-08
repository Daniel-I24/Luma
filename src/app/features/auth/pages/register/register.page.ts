import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, afterNextRender, inject, Injector } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { PendingVerification } from '@core/auth/pending-verification';
import { Phone } from '@shared/account/phone';
import { LEGAL_VERSIONS } from '@shared/legal/legal-version';
import { LumaButton, LumaCard } from '@design-system';
import { AuthFormSubmission } from '../../forms/auth-form-submission';
import { AccountTypeStep } from '../../signup/components/account-type-step/account-type-step';
import { ConsentStep } from '../../signup/components/consent-step/consent-step';
import { CredentialsStep } from '../../signup/components/credentials-step/credentials-step';
import { PersonalStep } from '../../signup/components/personal-step/personal-step';
import { PhotoStep } from '../../signup/components/photo-step/photo-step';
import { ResidenceStep } from '../../signup/components/residence-step/residence-step';
import { SignupProgress } from '../../signup/components/signup-progress/signup-progress';
import { SignupCompletion } from '../../signup/signup-completion';
import { SignupDraftStore } from '../../signup/signup-draft.store';

const STEP_TITLE_ID = 'signup-step-title';

/**
 * RegisterPage — /auth/register in six steps (account type, personal data,
 * residence, optional photo, credentials, consent); then the emailed code
 * (/auth/verify), after which residence and photo are saved.
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoModule,
    LumaButton,
    LumaCard,
    SignupProgress,
    AccountTypeStep,
    PersonalStep,
    ResidenceStep,
    PhotoStep,
    CredentialsStep,
    ConsentStep,
  ],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly pending = inject(PendingVerification);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly completion = inject(SignupCompletion);

  protected readonly store = inject(SignupDraftStore);
  protected readonly submission = new AuthFormSubmission();
  protected readonly stepTitleId = STEP_TITLE_ID;

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const index = this.store.index();
    const invalid = this.store.next();
    if (invalid) return this.focusAfterRender(`signup-${invalid}`);
    if (this.store.index() !== index) return this.focusAfterRender(STEP_TITLE_ID);
    await this.createAccount();
  }

  protected back(): void {
    if (this.store.back()) this.focusAfterRender(STEP_TITLE_ID);
  }

  private createAccount(): Promise<void> {
    const draft = this.store.draft();
    return this.submission.run(
      { invalid: false },
      () =>
        this.auth.signUp(draft.email, draft.password, {
          accountType: draft.accountType ?? 'customer',
          fullName: draft.fullName,
          phone: Phone.parse(draft.phone)?.e164 ?? null,
          acceptedTerms: draft.acceptedTerms,
          acceptedPrivacy: draft.acceptedPrivacy,
          confirmedAge: draft.isAdult,
          termsVersion: LEGAL_VERSIONS.terms,
          privacyVersion: LEGAL_VERSIONS.privacy,
        }),
      () => {
        this.completion.hold(draft);
        return this.onRegistered(draft.email);
      },
    );
  }

  /** The same next step whether or not the email already had an account. */
  private async onRegistered(email: string): Promise<void> {
    this.pending.set(email);
    this.store.reset();
    await this.router.navigate(['/auth/verify']);
  }

  private focusAfterRender(id: string): void {
    afterNextRender(() => this.document.getElementById(id)?.focus(), { injector: this.injector });
  }
}
