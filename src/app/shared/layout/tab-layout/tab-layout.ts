import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LumaTabBar } from '@design-system';
import type { TabBarItem } from '@design-system';
import { CartBar } from '@shared/cart/cart-bar/cart-bar';
import { CartConflictSheet } from '@shared/cart/cart-conflict-sheet/cart-conflict-sheet';
import { FavoritesStore } from '@shared/favorites/favorites.store';

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
 * Mounted around the five main tabs.
 */
@Component({
  selector: 'app-tab-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LumaTabBar, CartBar, CartConflictSheet],
  templateUrl: './tab-layout.html',
  styleUrl: './tab-layout.css',
})
export class TabLayout {
  protected readonly tabs = MAIN_TABS;
  // Eager injection: favourites load as soon as the user enters the app.
  private readonly favorites = inject(FavoritesStore);
}
