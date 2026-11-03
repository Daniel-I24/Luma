import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { UpdateCheck } from '@core/update/update-check.service';

/**
 * UpdateBanner — a newer Luma exists: on the web, "Actualizar" reloads; in
 * the APK, "Descargar" opens the /download page. An optional update can be
 * dismissed; a required one (below the minimum) cannot.
 */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    @if (visible()) {
      <div
        *transloco="let t"
        class="flex flex-wrap items-center gap-2 bg-surface-selected px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-2))] pb-2 text-body-sm text-fg"
        role="status"
      >
        <span class="flex-1">{{ t(required() ? 'update.required' : 'update.available', { version: updates.latest() }) }}</span>
        @if (!updates.native) {
          <button type="button" class="min-h-11 rounded-md bg-primary px-3 font-semibold text-primary-fg focus-visible:outline-2 focus-visible:outline-border-focus" (click)="updates.reload()">
            {{ t('update.reload') }}
          </button>
        } @else if (download) {
          <a [href]="download" target="_blank" rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center rounded-md bg-primary px-3 font-semibold text-primary-fg no-underline focus-visible:outline-2 focus-visible:outline-border-focus">
            {{ t('update.download') }}</a>
        }
        @if (!required()) {
          <button type="button" class="min-h-11 rounded-md px-3 font-semibold text-fg-brand focus-visible:outline-2 focus-visible:outline-border-focus" (click)="dismissed.set(true)">
            {{ t('update.later') }}
          </button>
        }
      </div>
    }
  `,
})
export class UpdateBanner {
  protected readonly updates = inject(UpdateCheck);
  protected readonly download = this.updates.downloadUrl();
  protected readonly dismissed = signal(false);
  protected readonly required = computed(() => this.updates.state() === 'required');
  protected readonly visible = computed(
    () => this.required() || (this.updates.state() === 'available' && !this.dismissed()),
  );
}
