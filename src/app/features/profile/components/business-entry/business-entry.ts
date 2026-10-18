import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { ownerPaths } from '@shared/account/owner-paths';

/**
 * BusinessEntry — Profile link back to Luma Negocios for business owners
 * (also the way back after "Ver como cliente"). /owner picks the business.
 */
@Component({
  selector: 'app-business-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon],
  templateUrl: './business-entry.html',
})
export class BusinessEntry {
  protected readonly link = ownerPaths.home();
}
