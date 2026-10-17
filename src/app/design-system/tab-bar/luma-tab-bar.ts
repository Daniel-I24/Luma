import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

export interface TabBarItem {
  path: string;
  /** Transloco key of the visible label. */
  labelKey: string;
  icon: IconName;
}

/** Index of the tab whose path is `url` or a parent of it; -1 when none. */
export function activeTabIndex(items: readonly TabBarItem[], url: string): number {
  const path = url.split(/[?#]/)[0];
  return items.findIndex((item) => path === item.path || path.startsWith(`${item.path}/`));
}

/**
 * LumaTabBar — bottom navigation bar. Marks the active tab with
 * aria-current="page", slides an indicator behind the active icon and
 * respects the device safe area.
 */
@Component({
  selector: 'app-luma-tab-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, LumaIcon],
  templateUrl: './luma-tab-bar.html',
  styleUrl: './luma-tab-bar.css',
})
export class LumaTabBar {
  readonly items = input.required<readonly TabBarItem[]>();
  /** Transloco key of the navigation landmark label. */
  readonly labelKey = input.required<string>();

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activeIndex = computed(() => activeTabIndex(this.items(), this.url()));
}
