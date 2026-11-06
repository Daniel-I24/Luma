import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { LumaIcon } from '../icon/luma-icon';
import { ValuePop } from '../motion/value-pop';
import type { IconName } from '../icon/luma-icons';

/** Badges show at most "9+". */
const MAX_BADGE = 9;

export interface TabBarItem {
  path: string;
  /** Transloco key of the visible label. */
  labelKey: string;
  icon: IconName;
}

/** TabBarRoutes — which tab matches the current URL. */
export class TabBarRoutes {
  /** Index of the tab whose path is `url` or a parent of it; -1 when none. */
  public static activeTabIndex(items: readonly TabBarItem[], url: string): number {
    const path = url.split(/[?#]/)[0] ?? '';
    return items.findIndex((item) => path === item.path || path.startsWith(`${item.path}/`));
  }
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
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, LumaIcon, ValuePop],
  template: `
    <nav class="luma-tab-bar" [attr.aria-label]="labelKey() | transloco">
      <div
        class="luma-tab-bar__track"
        [style.--tab-count]="items().length"
        [style.--tab-index]="activeIndex()"
      >
        <span
          class="luma-tab-bar__indicator"
          [class.luma-tab-bar__indicator--hidden]="activeIndex() < 0"
          aria-hidden="true"
        ></span>
        <ul class="luma-tab-bar__list">
          @for (item of items(); track item.path) {
          <li class="luma-tab-bar__item">
            <a
              class="luma-tab-bar__link"
              [routerLink]="item.path"
              routerLinkActive="luma-tab-bar__link--active"
              ariaCurrentWhenActive="page"
            >
              <span class="luma-tab-bar__pill">
                <app-luma-icon class="luma-tab-bar__icon" [name]="item.icon" />
                @if (badges()[item.path]; as count) {
                <span class="luma-tab-bar__badge" aria-hidden="true" [appValuePop]="count">{{ badgeText(count) }}</span>
                }
              </span>
              <span class="luma-tab-bar__label">{{ item.labelKey | transloco }}</span>
              @if (badges()[item.path]; as count) {
              <span class="sr-only">{{ badgeLabelKey() | transloco: { count } }}</span>
              }
            </a>
          </li>
          }
        </ul>
      </div>
    </nav>
  `,
  styleUrl: './luma-tab-bar.css',
})
export class LumaTabBar {
  public readonly items = input.required<readonly TabBarItem[]>();
  /** Transloco key of the navigation landmark label. */
  public readonly labelKey = input.required<string>();
  /** Counts shown on tabs, by path (e.g. unread notifications); 0 hides it. */
  public readonly badges = input<Readonly<Record<string, number>>>({});
  /** Transloco key of the badge text for screen readers, with {{count}}. */
  public readonly badgeLabelKey = input('tabBar.badge');

  protected badgeText(count: number): string {
    return count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
  }

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activeIndex = computed(() => TabBarRoutes.activeTabIndex(this.items(), this.url()));
}
