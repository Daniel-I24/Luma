import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ToastService } from '@design-system';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import type { Business } from '@shared/business/models/business.model';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { ImageField } from '../image-field/image-field';

type ImageColumn = 'logo_url' | 'cover_url';

/**
 * BusinessImages — logo and cover of the managed business, saved as soon as
 * they are uploaded; the replaced file is deleted only after the save.
 */
@Component({
  selector: 'app-business-images',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, ImageField],
  templateUrl: './business-images.html',
})
export class BusinessImages {
  protected readonly panel = inject(PanelBusinessStore);
  private readonly owned = inject(OwnedBusinessRepository);
  private readonly images = inject(BusinessImageRepository);
  private readonly toast = inject(ToastService);

  protected readonly errorKey = signal<string | null>(null);

  protected async save(business: Business, column: ImageColumn, url: string | null): Promise<void> {
    const previous = business[column];
    this.errorKey.set(null);
    const result = await this.owned.updateImages(business.id, { [column]: url });
    if (result.errorKey) {
      this.errorKey.set(result.errorKey);
      await this.images.remove(url);
      return;
    }
    this.panel.patch({ [column]: url });
    this.toast.show({ messageKey: 'businessPanel.images.saved', tone: 'success' });
    if (previous && previous !== url) await this.images.remove(previous);
  }
}
