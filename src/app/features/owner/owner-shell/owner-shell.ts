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
import { PollWhileVisible } from '@shared/ui/poll-while-visible';
import { ORDER_ALERT_POLL_MS, OrderAlertsStore } from '../state/order-alerts.store';
import { OwnerContextStore } from '../state/owner-context.store';

const TAB_ICONS = {
  summary: 'compass',
  orders: 'receipt',
  menu: 'utensils',
  promotions: 'tag',
  business: 'store',
} as const satisfies Record<OwnerSection, TabBarItem['icon']>;

/** OwnerLocation — which business and section the owner URL points to. */
export class OwnerLocation {
  /** The business id and tab of a /owner/:id/:section/... URL (null elsewhere, e.g. /owner/new). */
  public static ownerLocation(url: string): { id: string; section: OwnerSection } | null {
    const [owner, id, section] = url.split(/[?#]/)[0].split('/').filter(Boolean);
    if (owner !== 'owner' || !id || id === 'new') return null;
    const known = (OWNER_SECTIONS as readonly string[]).includes(section);
    return { id, section: known ? (section as OwnerSection) : 'summary' };
  }
}

/**
 * OwnerShell — "Luma Negocios": header with the business switcher and
 * "Añadir otro negocio" (at most 3), the screen, and its own tab bar
 * (Resumen, Pedidos, Menú, Promociones, Mi negocio). New orders alert on
 * every screen (badge on Pedidos, toast and vibration).
 */
@Component({
  selector: 'app-owner-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, TranslocoModule, LumaIcon, LumaTabBar],
  templateUrl: './owner-shell.html',
  providers: [OrderAlertsStore],
  host: { class: 'flex h-dvh flex-col bg-canvas' },
})
export class OwnerShell {
  private readonly router = inject(Router);
  protected readonly context = inject(OwnerContextStore);
  private readonly alerts = inject(OrderAlertsStore);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly location = computed(() => OwnerLocation.ownerLocation(this.url()));
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
  /** Pending orders on the Pedidos tab. */
  protected readonly badges = computed<Record<string, number>>(() => {
    const id = this.location()?.id;
    return id ? { [ownerPaths.section(id, 'orders').join('/')]: this.alerts.pending() } : {};
  });

  constructor() {
    if (this.context.businesses() === null) void this.context.load();
    effect(() => {
      const id = this.location()?.id;
      if (id)
        untracked(() => {
          this.context.select(id);
          void this.alerts.watch(id);
        });
    });
    PollWhileVisible.pollWhileVisible(() => void this.alerts.refresh(), ORDER_ALERT_POLL_MS);
  }

  /** Same tab, other business. */
  protected switchTo(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const section = this.location()?.section ?? 'summary';
    void this.router.navigate(ownerPaths.section(id, section));
  }
}
