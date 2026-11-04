import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaNotice, ToastService } from '@design-system';
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
  imports: [LumaNotice, TranslocoModule, ImageField],
  template: `
    @if (panel.business(); as business) {
    <section
      *transloco="let t"
      class="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface p-4"
    >
      <app-image-field
        fieldId="business-logo"
        kind="logo"
        [label]="t('businessPanel.images.logo')"
        [alt]="t('media.logoAlt', { name: business.name })"
        [businessId]="business.id"
        [url]="business.logo_url"
        (changed)="save(business, 'logo_url', $event)"
      />
      <app-image-field
        fieldId="business-cover"
        kind="cover"
        [label]="t('businessPanel.images.cover')"
        [alt]="t('media.coverAlt', { name: business.name })"
        [businessId]="business.id"
        [url]="business.cover_url"
        (changed)="save(business, 'cover_url', $event)"
      />
      @if (errorKey(); as key) {
      <app-luma-notice tone="danger">
        {{ t(key) }}
      </app-luma-notice>
      }
    </section>
    }
  `,
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
