import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComingSoonPage } from '@shared/layout/coming-soon-page/coming-soon-page';

/** FeedPage — /feed (protected by authGuard). Vertical feed of promotions and news; not built yet. */
@Component({
  selector: 'app-feed-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComingSoonPage],
  templateUrl: './feed.page.html',
  host: { class: 'block h-full' },
})
export class FeedPage {}
