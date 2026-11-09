import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon, LumaIconButton, ToastService } from '@design-system';
import { GuidedTour } from './guided-tour.service';
import type { TourId } from './tour-registry';

/** Where each section guide runs: customer screens, or the sections of a business ({id}). */
const CUSTOMER_TOURS: readonly (readonly [TourId, string])[] = [
  ['map', '/map'], ['discover', '/feed'], ['orders', '/orders'], ['ai', '/ai'], ['profile', '/profile'], ['checkout', '/cart'],
];
const OWNER_TOURS: readonly (readonly [TourId, string])[] = [
  ['owner-summary', 'summary'], ['owner-orders', 'orders'], ['owner-menu', 'menu'],
  ['owner-promotions', 'promotions'], ['owner-business', 'business'],
];

/**
 * TutorialsPanel — /tutorials and /owner/:id/tutorials ("Tutoriales"): the
 * welcome tutorial and every section guide with a "vista" mark, "Repetir"
 * (opens that screen with its guide) and "Reiniciar todas".
 */
@Component({
  selector: 'app-tutorials-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIcon, LumaIconButton],
  template: `
    <main
      *transloco="let t"
      class="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-[calc(var(--inset-top)+var(--spacing-4))] pb-[calc(env(safe-area-inset-bottom)+var(--spacing-8))]"
    >
      <header class="flex items-center gap-2">
        <app-luma-icon-button icon="arrow-left" variant="ghost" [label]="t('common.back')" (clicked)="back()" />
        <h1 class="m-0 text-title text-fg">{{ t('tutorials.title') }}</h1>
      </header>

      <section class="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4" aria-labelledby="tutorials-welcome">
        <h2 id="tutorials-welcome" class="m-0 text-body font-semibold text-fg">{{ t('tutorials.welcome') }}</h2>
        <p class="m-0 text-body-sm text-fg-muted">{{ t('tutorials.welcomeHint') }}</p>
        <app-luma-button variant="secondary" (clicked)="welcome()">{{ t('tutorials.repeat') }}</app-luma-button>
      </section>

      <section class="flex flex-col gap-2" aria-labelledby="tutorials-guides">
        <h2 id="tutorials-guides" class="m-0 px-1 text-label tracking-wide text-fg-subtle uppercase">{{ t('tutorials.guides') }}</h2>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (guide of guides(); track guide.id) {
          <li class="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3">
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-body font-medium text-fg">{{ t('tutorials.sections.' + guide.id) }}</span>
              <span class="inline-flex items-center gap-1 text-caption" [class]="guide.seen ? 'text-success-fg' : 'text-fg-subtle'">
                @if (guide.seen) { <app-luma-icon name="check" size="sm" /> {{ t('tutorials.seen') }} } @else { {{ t('tutorials.notSeen') }} }
              </span>
            </span>
            <app-luma-button variant="ghost" size="sm" (clicked)="repeat(guide.id, guide.path)">{{ t('tutorials.repeat') }}</app-luma-button>
          </li>
          }
        </ul>
      </section>

      <app-luma-button variant="secondary" [fullWidth]="true" (clicked)="resetAll()">{{ t('tutorials.resetAll') }}</app-luma-button>
    </main>
  `,
  host: { class: 'block min-h-dvh bg-canvas' },
})
export class TutorialsPanel {
  private readonly tour = inject(GuidedTour);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly toast = inject(ToastService);
  private readonly businessId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  /** Bumped after a reset so the marks read the storage again. */
  private readonly version = signal(0);

  protected readonly guides = computed(() => {
    this.version();
    const list = this.businessId ? OWNER_TOURS.map(([id, section]) => [id, `/owner/${this.businessId}/${section}`] as const) : CUSTOMER_TOURS;
    return list.map(([id, path]) => ({ id, path, seen: this.tour.seen(id) }));
  });

  protected welcome(): void {
    this.tour.openWelcome();
  }

  /** "Repetir": the guide shows again on its screen. */
  protected async repeat(id: TourId, path: string): Promise<void> {
    this.tour.forget(id);
    await this.router.navigateByUrl(path);
  }

  protected resetAll(): void {
    this.tour.resetAll();
    this.version.update((v) => v + 1);
    this.toast.show({ messageKey: 'profile.help.allTutorialsReset', tone: 'success' });
  }

  protected back(): void {
    this.location.back();
  }
}
