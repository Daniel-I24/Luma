import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ResidencePicker } from '@shared/geo/residence-picker/residence-picker';
import type { Residence } from '@shared/geo/residence';
import { SignupDraftStore } from '../../signup-draft.store';

/** Step 3 — department and municipality of residence (DANE catalog), neighbourhood optional. */
@Component({
  selector: 'app-residence-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, ResidencePicker],
  template: `
    <div *transloco="let t" id="signup-residence" tabindex="-1" class="flex flex-col gap-3 outline-none">
      <app-residence-picker [value]="store.draft().residence" (valueChange)="onChange($event)" />
      @if (store.errors().residence; as key) {
        <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
      }
    </div>
  `,
})
export class ResidenceStep {
  protected readonly store = inject(SignupDraftStore);

  protected onChange(residence: Residence | null): void {
    this.store.update('residence', residence);
  }
}
