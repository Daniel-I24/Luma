import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import {
  LumaButton,
  LumaEmptyState,
  LumaIcon,
  LumaSkeleton,
  LumaTabs,
  tabElementId,
  tabPanelId,
} from '@design-system';
import type { TabItem } from '@design-system';
import { AuthService } from '@core/auth/auth.service';
import { categoryIcon } from '@shared/business/utils/category-icon.util';
import { InfoTab } from './components/info-tab/info-tab';
import { MenuTab } from './components/menu-tab/menu-tab';
import { ProfileHero } from './components/profile-hero/profile-hero';
import { ProfileStats } from './components/profile-stats/profile-stats';
import { PromosTab } from './components/promos-tab/promos-tab';
import { ReviewsTab } from './components/reviews-tab/reviews-tab';
import { BusinessProfileStore } from './state/business-profile.store';
import { ReviewsStore } from './state/reviews.store';

export type ProfileTab = 'menu' | 'promos' | 'reviews' | 'info';
export const PROFILE_TABS: readonly ProfileTab[] = ['menu', 'promos', 'reviews', 'info'];

/** BusinessProfilePage — /businesses/:id: the public profile of a business. */
@Component({
  selector: 'app-business-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaEmptyState,
    LumaIcon,
    LumaSkeleton,
    LumaTabs,
    InfoTab,
    MenuTab,
    ProfileHero,
    ProfileStats,
    PromosTab,
    ReviewsTab,
  ],
  providers: [BusinessProfileStore, ReviewsStore],
  templateUrl: './business-profile.page.html',
  host: { class: 'block min-h-full bg-canvas' },
})
export class BusinessProfilePage {
  protected readonly store = inject(BusinessProfileStore);
  private readonly reviews = inject(ReviewsStore);
  private readonly auth = inject(AuthService);
  /** Owners cannot review their own business (also enforced by RLS). */
  protected readonly isOwner = computed(
    () => this.auth.user()?.id === this.store.business()?.owner_id,
  );
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$);

  protected readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );
  protected readonly tab = signal<ProfileTab>('menu');
  protected readonly tabs = PROFILE_TABS;
  protected readonly tabItems = computed<TabItem[]>(() => {
    this.lang();
    return PROFILE_TABS.map((id) => ({
      id,
      label: this.transloco.translate(`businessProfile.tabs.${id}`),
    }));
  });
  protected readonly tabElementId = tabElementId;
  protected readonly tabPanelId = tabPanelId;
  protected readonly categoryIcon = categoryIcon;

  constructor() {
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.tab.set('menu');
      void this.store.load(id);
      void this.reviews.load(id);
    });
  }

  protected reload(): void {
    void this.store.load(this.id());
  }

  /** Back to where the user came from, or to the map after a direct link. */
  protected back(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/map']);
  }
}
