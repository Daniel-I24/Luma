import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LumaTabBar } from '@design-system';
import type { TabBarItem } from '@design-system';
import { CartBar } from '@shared/cart/cart-bar/cart-bar';
import { CartConflictSheet } from '@shared/cart/cart-conflict-sheet/cart-conflict-sheet';
import { FavoritesStore } from '@shared/favorites/favorites.store';
import { OwnerReturnBanner } from '@shared/layout/owner-return-banner/owner-return-banner';
import { UnreadNotifications } from '@shared/notifications/unread-notifications';
import { pollWhileVisible } from '@shared/ui/poll-while-visible';

/** How often the unread badge is refreshed while the app is visible. */
export const UNREAD_REFRESH_MS = 30_000;

const MAIN_TABS: readonly TabBarItem[] = [
  { path: '/map', labelKey: 'tabBar.map', icon: 'map' },
  { path: '/feed', labelKey: 'tabBar.feed', icon: 'compass' },
  { path: '/ai', labelKey: 'tabBar.ai', icon: 'sparkles' },
  { path: '/orders', labelKey: 'tabBar.orders', icon: 'receipt' },
  { path: '/profile', labelKey: 'tabBar.profile', icon: 'user' },
];

/**
 * TabLayout — shell for the signed-in sections: page content on top and the
 * main tab bar at the bottom, with the cart bar and the cart conflict sheet.
 * Mounted around the five main tabs. Owns the unread notifications count
 * (Profile badge), refreshed every 30 s while the app is visible.
 */
@Component({
  selector: 'app-tab-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LumaTabBar, CartBar, CartConflictSheet, OwnerReturnBanner],
  templateUrl: './tab-layout.html',
  styleUrl: './tab-layout.css',
  providers: [UnreadNotifications],
})
export class TabLayout {
  protected readonly tabs = MAIN_TABS;
  // Eager injection: favourites load as soon as the user enters the app.
  private readonly favorites = inject(FavoritesStore);
  private readonly unread = inject(UnreadNotifications);
  protected readonly badges = computed(() => ({ '/profile': this.unread.count() }));

  constructor() {
    void this.unread.refresh();
    pollWhileVisible(() => void this.unread.refresh(), UNREAD_REFRESH_MS);
  }
}
