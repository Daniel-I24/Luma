import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

/** SignupProgress — "Paso 2 de 4" and one segment per step. */
@Component({
  selector: 'app-signup-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <div *transloco="let t" class="flex flex-col gap-2">
      <p class="m-0 text-body-sm text-fg-muted">
        {{ t('auth.signup.progress', { current: index() + 1, total: total() }) }}
      </p>
      <div
        class="flex gap-1"
        role="progressbar"
        [attr.aria-valuenow]="index() + 1"
        aria-valuemin="1"
        [attr.aria-valuemax]="total()"
        [attr.aria-label]="t('auth.signup.progressLabel')"
      >
        @for (segment of segments(); track segment) {
          <span
            class="h-1.5 flex-1 rounded-full bg-primary transition-opacity duration-(--duration-normal) motion-reduce:transition-none"
            [class.opacity-25]="segment > index()"
          ></span>
        }
      </div>
    </div>
  `,
})
export class SignupProgress {
  readonly index = input.required<number>();
  readonly total = input.required<number>();

  protected readonly segments = computed(() => Array.from({ length: this.total() }, (_, i) => i));
}
