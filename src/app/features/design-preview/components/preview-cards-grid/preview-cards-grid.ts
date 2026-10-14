import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaCard } from '@design-system';

/** PreviewCardsGrid — shows every LumaCard elevation in the design preview. */
@Component({
  selector: 'app-preview-cards-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaCard],
  templateUrl: './preview-cards-grid.html',
  styleUrl: './preview-cards-grid.css',
})
export class PreviewCardsGrid {}
