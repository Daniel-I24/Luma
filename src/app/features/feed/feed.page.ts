import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaIconButton, LumaSkeleton } from '@design-system';
import { NearViewportDirective } from '@shared/ui/near-viewport.directive';
import { FeedCard } from './components/feed-card/feed-card';
import type { FeedCard as FeedCardModel } from './models/feed-card.model';
import { FeedStore } from './state/feed.store';

/**
 * FeedPage — /feed: vertical, full-screen posts (one per screen, scroll
 * snap) with promotions and dishes of nearby businesses. WAI-ARIA feed
 * pattern; ↑/↓ and the side buttons move between posts.
 */
@Component({
  selector: 'app-feed-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    RouterLink,
    LumaButton,
    LumaEmptyState,
    LumaIconButton,
    LumaSkeleton,
    NearViewportDirective,
    FeedCard,
  ],
  providers: [FeedStore],
  templateUrl: './feed.page.html',
  host: { class: 'block h-full' },
})
export class FeedPage {
  protected readonly store = inject(FeedStore);
  private readonly router = inject(Router);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  /** Index of the post filling the screen. */
  protected readonly current = signal(0);

  constructor() {
    void this.store.load();
  }

  protected onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el || el.clientHeight === 0) return;
    this.current.set(Math.round(el.scrollTop / el.clientHeight));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    this.goTo(this.current() + step);
  }

  /** Scrolls to a post and moves focus to it (feed pattern). */
  protected goTo(index: number): void {
    const el = this.scroller()?.nativeElement;
    const posts = el?.querySelectorAll<HTMLElement>('app-feed-card article');
    if (!el || !posts || index < 0 || index >= posts.length) return;
    this.current.set(index);
    el.scrollTo({ top: index * el.clientHeight });
    posts[index].focus({ preventScroll: true });
  }

  protected viewBusiness(card: FeedCardModel): void {
    void this.router.navigate(['/businesses', card.business.id]);
  }
}
