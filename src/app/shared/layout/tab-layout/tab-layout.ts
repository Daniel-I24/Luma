import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LumaTabBar } from '@design-system';
import type { TabBarItem } from '@design-system';

const MAIN_TABS: readonly TabBarItem[] = [
  { path: '/map', labelKey: 'tabBar.map', icon: 'map' },
  { path: '/profile', labelKey: 'tabBar.profile', icon: 'user' },
  { path: '/settings', labelKey: 'tabBar.settings', icon: 'settings' },
];

/**
 * TabLayout — shell for the signed-in sections: page content on top and the
 * main tab bar at the bottom. Mounted around /map, /profile and /settings.
 */
@Component({
  selector: 'app-tab-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LumaTabBar],
  templateUrl: './tab-layout.html',
  styleUrl: './tab-layout.css',
})
export class TabLayout {
  protected readonly tabs = MAIN_TABS;
}
