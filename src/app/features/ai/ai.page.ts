import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComingSoonPage } from '@shared/layout/coming-soon-page/coming-soon-page';

/** AiPage — /ai (protected by authGuard). Luma AI recommender and custom combos; not built yet. */
@Component({
  selector: 'app-ai-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComingSoonPage],
  templateUrl: './ai.page.html',
  host: { class: 'block h-full' },
})
export class AiPage {}
