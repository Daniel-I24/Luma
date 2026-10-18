import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { LumaIcon, LumaTabBar, type TabBarItem } from '@design-system';
import { OWNER_SECTIONS, type OwnerSection, ownerPaths } from '@shared/account/owner-paths';
import { OwnerContextStore } from '../state/owner-context.store';

const TAB_ICONS = {
  summary: 'compass',
  orders: 'receipt',
  menu: 'utensils',
  promotions: 'tag',
  business: 'store',
} as const satisfies Record<OwnerSection, TabBarItem['icon']>;

/** The business id and tab of a /owner/:id/:section/... URL (null elsewhere, e.g. /owner/new). */
export function ownerLocation(url: string): { id: string; section: OwnerSection } | null {
  const [owner, id, section] = url.split(/[?#]/)[0].split('/').filter(Boolean);
  if (owner !== 'owner' || !id || id === 'new') return null;
  const known = (OWNER_SECTIONS as readonly string[]).includes(section);
  return { id, section: known ? (section as OwnerSection) : 'summary' };
}

/**
 * OwnerShell — "Luma Negocios": header with the business switcher and
 * "Añadir otro negocio" (at most 3), the screen, and its own tab bar
 * (Resumen, Pedidos, Menú, Promociones, Mi negocio).
 */
@Component({
  selector: 'app-owner-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, TranslocoModule, LumaIcon, LumaTabBar],
  templateUrl: './owner-shell.html',
  host: { class: 'flex h-dvh flex-col bg-canvas' },
})
export class OwnerShell {
  private readonly router = inject(Router);
  protected readonly context = inject(OwnerContextStore);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly location = computed(() => ownerLocation(this.url()));
  protected readonly tabs = computed<readonly TabBarItem[]>(() => {
    const id = this.location()?.id;
    if (!id) return [];
    return OWNER_SECTIONS.map((section) => ({
      path: ownerPaths.section(id, section).join('/'),
      labelKey: `owner.tabs.${section}`,
      icon: TAB_ICONS[section],
    }));
  });
  protected readonly registerLink = ownerPaths.register();

  constructor() {
    if (this.context.businesses() === null) void this.context.load();
    effect(() => {
      const id = this.location()?.id;
      if (id) untracked(() => this.context.select(id));
    });
  }

  /** Same tab, other business. */
  protected switchTo(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const section = this.location()?.section ?? 'summary';
    void this.router.navigate(ownerPaths.section(id, section));
  }
}
