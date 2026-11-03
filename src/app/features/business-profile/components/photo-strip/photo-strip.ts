import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaImage, LumaSkeleton } from '@design-system';
import { type BusinessPhoto, BusinessPhotoRepository } from '@shared/business/data/business-photo.repository';

/**
 * PhotoStrip — the photos of the place on the public profile, in a
 * horizontal strip. Hidden when the business has none (or the gallery
 * cannot be read: it is a nice-to-have, never an error state).
 */
@Component({
  selector: 'app-photo-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaImage, LumaSkeleton],
  template: `
    <ng-container *transloco="let t">
      @if (loading()) {
        <app-luma-skeleton class="h-28 w-full" shape="rect" />
      } @else if (photos().length) {
        <section aria-labelledby="photo-strip-title">
          <h3 id="photo-strip-title" class="m-0 mb-2 text-title text-fg">{{ t('businessProfile.photos.title') }}</h3>
          <ul class="m-0 flex list-none snap-x gap-2 overflow-x-auto p-0 pb-1" [attr.aria-label]="t('businessProfile.photos.title')">
            @for (photo of photos(); track photo.id; let i = $index) {
              <li class="shrink-0 snap-start">
                <figure class="m-0 flex w-36 flex-col gap-1">
                  <app-luma-image
                    class="overflow-hidden rounded-md"
                    [src]="photo.url"
                    [alt]="photo.caption ?? t('businessProfile.photos.photo', { n: i + 1, name: businessName() })"
                    [width]="144"
                    [height]="112"
                    fallbackIcon="image"
                  />
                  @if (photo.caption) {
                    <figcaption class="truncate text-caption text-fg-muted">{{ photo.caption }}</figcaption>
                  }
                </figure>
              </li>
            }
          </ul>
        </section>
      }
    </ng-container>
  `,
})
export class PhotoStrip {
  private readonly repo = inject(BusinessPhotoRepository);

  public readonly businessId = input.required<string>();
  public readonly businessName = input.required<string>();

  protected readonly photos = signal<readonly BusinessPhoto[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const id = this.businessId();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    const result = await this.repo.list(id);
    if (id !== this.businessId()) return;
    this.photos.set(result.data ?? []);
    this.loading.set(false);
  }
}
