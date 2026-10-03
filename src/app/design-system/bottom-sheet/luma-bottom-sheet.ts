import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';

/**
 * LumaBottomSheet — modal panel that slides up from the bottom of the screen.
 *
 * - Role: dialog (ARIA)
 * - Overlay click and Escape key close the sheet.
 * - Entrance/exit animation respects prefers-reduced-motion.
 */
@Component({
  selector: 'app-luma-bottom-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './luma-bottom-sheet.html',
  styleUrl: './luma-bottom-sheet.css',
})
export class LumaBottomSheet {
  readonly open = input<boolean>(false);
  readonly title = input<string | undefined>(undefined);
  readonly titleId = input<string>('bottom-sheet-title');
  readonly closeOnOverlay = input<boolean>(true);

  readonly closed = output<void>();

  protected readonly isOpen = computed(() => this.open());

  protected get panelClasses(): string {
    return [
      'luma-bottom-sheet__panel',
      this.isOpen() ? 'luma-bottom-sheet__panel--open' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected onOverlayClick(): void {
    if (this.closeOnOverlay()) {
      this.closed.emit();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closed.emit();
    }
  }

  protected onPanelClick(event: Event): void {
    // Prevent clicks inside the panel from reaching the overlay.
    event.stopPropagation();
  }

  protected onCloseClick(): void {
    this.closed.emit();
  }
}
