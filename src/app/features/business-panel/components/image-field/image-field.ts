import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaImage, LumaSkeleton } from '@design-system';
import { ACCEPTED_IMAGE_TYPES } from '@shared/media/image-file.util';
import {
  type BusinessImageKind,
  BusinessImageRepository,
} from '@shared/media/business-image.repository';

/**
 * ImageField — picture of a business, product or promotion: preview,
 * "Subir / Cambiar imagen" (validated, resized and re-encoded before
 * uploading) and "Quitar imagen". Emits the new URL through `url`; the
 * parent saves it and then removes the replaced file.
 */
@Component({
  selector: 'app-image-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaImage, LumaSkeleton],
  templateUrl: './image-field.html',
})
export class ImageField {
  private readonly images = inject(BusinessImageRepository);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  readonly fieldId = input.required<string>();
  /** Already translated label and alternative text of the preview. */
  readonly label = input.required<string>();
  readonly alt = input.required<string>();
  readonly businessId = input.required<string>();
  readonly kind = input.required<BusinessImageKind>();
  readonly url = model<string | null>(null);
  /** Emitted after a successful upload or removal, with the new URL. */
  readonly changed = output<string | null>();

  protected readonly accept = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly uploading = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected pick(): void {
    this.fileInput().nativeElement.click();
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading()) return;
    this.uploading.set(true);
    this.errorKey.set(null);
    const result = await this.images.upload(this.businessId(), this.kind(), file);
    this.uploading.set(false);
    if (!result.data) {
      this.errorKey.set(result.errorKey);
      return;
    }
    this.url.set(result.data);
    this.changed.emit(result.data);
  }

  protected clear(): void {
    this.errorKey.set(null);
    this.url.set(null);
    this.changed.emit(null);
  }
}
