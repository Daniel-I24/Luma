import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AI_MODE } from '@core/config/build-flags';
import { FieldRules } from '@core/validation/field-rule';
import { TextRules } from '@core/validation/text-rules';
import { LumaButton, LumaNotice, LumaSkeleton } from '@design-system';
import { ACCEPTED_IMAGE_TYPES } from '@shared/media/image-files';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { MAX_SCAN_PHOTOS } from '../../services/menu-scan.repository';
import { MenuScanStore, type ReviewItem, ScanPrices } from '../../state/menu-scan.store';
import { RouteBusinessId } from '../../utils/route-business-id';

/**
 * MenuScanPage — /owner/:id/menu/scan: photos of a printed menu read by
 * Luma IA, or the menu pasted as text (free plan B, always offered and the
 * only one when Luma IA is not available), into a draft the owner corrects
 * and chooses from. Nothing reaches the menu until "Agregar al menú".
 */
@Component({
  selector: 'app-menu-scan-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, TranslocoModule, RouterLink, LumaButton, LumaSkeleton, PanelHeader],
  providers: [MenuScanStore],
  templateUrl: './menu-scan.page.html',
  host: { class: 'block' },
})
export class MenuScanPage {
  protected readonly scan = inject(MenuScanStore);
  protected readonly id = RouteBusinessId.routeBusinessId();
  protected readonly accept = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly maxPhotos = MAX_SCAN_PHOTOS;
  /** Reading photos needs the extract-menu function (Luma IA remote). */
  protected readonly aiAvailable = inject(AI_MODE) === 'remote';
  protected readonly pasted = signal('');
  protected readonly nameMax = TextRules.productName.maxLength;
  protected readonly sectionMax = TextRules.menuSection.maxLength;
  /** A chosen product that would not pass the menu rules blocks "Agregar al menú". */
  protected readonly invalid = computed(() =>
    this.scan.chosen().some((item) => this.nameError(item) || this.sectionError(item) || this.priceMissing(item)),
  );

  protected async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    await this.scan.read(this.id(), files);
  }

  protected onPaste(event: Event): void {
    this.pasted.set((event.target as HTMLTextAreaElement).value);
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected toggle(item: ReviewItem, event: Event): void {
    this.scan.edit(item.key, { selected: (event.target as HTMLInputElement).checked });
  }

  protected nameError(item: ReviewItem): string | null {
    return item.selected ? FieldRules.checkRequired(TextRules.productName, item.name) : null;
  }

  protected sectionError(item: ReviewItem): string | null {
    return item.selected && item.section.trim() ? FieldRules.check(TextRules.menuSection, item.section) : null;
  }

  protected priceMissing(item: ReviewItem): boolean {
    return item.selected && ScanPrices.priceOf(item.price) === null;
  }
}
