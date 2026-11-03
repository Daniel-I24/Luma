import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { FieldRules } from '@core/validation/field-rule';
import { TextRules } from '@core/validation/text-rules';
import { LumaButton, LumaIconButton, LumaImage, LumaSkeleton } from '@design-system';
import { type BusinessPhoto, MAX_CAPTION, MAX_PHOTOS } from '@shared/business/data/business-photo.repository';
import { ACCEPTED_IMAGE_TYPES } from '@shared/media/image-files';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { GalleryStore } from '../../state/gallery.store';
import { RouteBusinessId } from '../../utils/route-business-id';

/**
 * BusinessGalleryPage — /owner/:id/business/gallery: up to 8 photos of the
 * place for the public profile (re-encoded before uploading, so no GPS
 * metadata), with a short caption, order and deletion.
 */
@Component({
  selector: 'app-business-gallery-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIconButton, LumaImage, LumaSkeleton, PanelHeader],
  providers: [GalleryStore],
  templateUrl: './business-gallery.page.html',
  host: { class: 'block' },
})
export class BusinessGalleryPage {
  protected readonly gallery = inject(GalleryStore);
  protected readonly id = RouteBusinessId.routeBusinessId();
  protected readonly accept = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly max = MAX_PHOTOS;
  protected readonly maxCaption = MAX_CAPTION;
  /** Photo waiting for the second tap that confirms its deletion. */
  protected readonly confirming = signal<string | null>(null);
  /** Why a typed caption was not saved, per photo. */
  protected readonly captionErrors = signal<Readonly<Record<string, string | null>>>({});

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.gallery.load(id));
    });
  }

  protected async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) await this.gallery.add(files);
  }

  protected async onCaption(photo: BusinessPhoto, event: Event): Promise<void> {
    const typed = (event.target as HTMLInputElement).value;
    const key = typed.trim() ? FieldRules.check(TextRules.photoCaption, typed) : null;
    this.captionErrors.update((errors) => ({ ...errors, [photo.id]: key }));
    if (!key) await this.gallery.caption(photo, TextRules.photoCaption.normalize(typed));
  }

  protected async remove(photo: BusinessPhoto): Promise<void> {
    if (this.confirming() !== photo.id) {
      this.confirming.set(photo.id);
      return;
    }
    this.confirming.set(null);
    await this.gallery.remove(photo);
  }
}
