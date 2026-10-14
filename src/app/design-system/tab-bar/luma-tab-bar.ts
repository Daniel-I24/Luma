import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LumaIcon } from '../icon/luma-icon';
import type { IconName } from '../icon/luma-icons';

export interface TabBarItem {
  path: string;
  /** Transloco key of the visible label. */
  labelKey: string;
  icon: IconName;
}

/**
 * LumaTabBar — bottom navigation bar. Marks the active tab with
 * aria-current="page" and respects the device safe area.
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
}
