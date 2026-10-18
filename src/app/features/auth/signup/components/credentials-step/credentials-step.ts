import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton, LumaInput } from '@design-system';
import { passwordStrength } from '../../password-strength';
import { SignupDraftStore } from '../../signup-draft.store';

const STRENGTH_LEVEL = { empty: 0, weak: 1, fair: 2, strong: 3 } as const;

/** Step 3 — email and password, with show/hide and a strength meter. */
@Component({
  selector: 'app-credentials-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaInput, LumaIconButton],
  templateUrl: './credentials-step.html',
})
export class CredentialsStep {
  protected readonly store = inject(SignupDraftStore);
  protected readonly showPassword = signal(false);
  protected readonly strength = computed(() => passwordStrength(this.store.draft().password));
  protected readonly level = computed(() => STRENGTH_LEVEL[this.strength()]);
  protected readonly bars = [1, 2, 3] as const;
}
