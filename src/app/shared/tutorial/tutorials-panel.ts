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
  templateUrl: './tutorials-panel.html',
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
