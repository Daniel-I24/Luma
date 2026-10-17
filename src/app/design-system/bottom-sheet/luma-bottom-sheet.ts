import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LumaIcon } from '../icon/luma-icon';
import { SheetDrag } from './sheet-drag';

/**
 * LumaBottomSheet — modal panel that slides up from the bottom of the screen.
 *
 * - Role: dialog (ARIA)
 * - Overlay click, Escape, the close button and dragging the handle or the
 *   header down close the sheet.
 * - Slides in and out (fade only under prefers-reduced-motion).
 */
@Component({
  selector: 'app-luma-bottom-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LumaIcon],
  templateUrl: './luma-bottom-sheet.html',
  styleUrl: './luma-bottom-sheet.css',
})
export class LumaBottomSheet {
  readonly open = input<boolean>(false);
  readonly title = input<string | undefined>(undefined);
  readonly titleId = input<string>('bottom-sheet-title');
  /** Id of a heading inside the projected content, used when there is no title. */
  readonly ariaLabelledBy = input<string | null>(null);
  readonly closeOnOverlay = input<boolean>(true);

  readonly closed = output<void>();

  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private returnFocusTo: HTMLElement | null = null;

  /** Drag-to-close on the handle or the header. */
  protected readonly drag = new SheetDrag(
    () => this.panel().nativeElement,
    () => this.closed.emit(),
  );

  protected readonly isOpen = computed(() => this.open());
  protected readonly labelledBy = computed(() =>
    this.title() ? this.titleId() : this.ariaLabelledBy(),
  );

  constructor() {
    // Move focus into the sheet when it opens and give it back when it closes.
    effect(() => {
      if (this.isOpen()) {
        this.drag.reset();
        this.returnFocusTo = this.document.activeElement as HTMLElement | null;
        afterNextRender(() => this.panel().nativeElement.focus(), { injector: this.injector });
      } else {
        this.returnFocusTo?.focus();
        this.returnFocusTo = null;
      }
    });
  }

  protected get panelClasses(): string {
    return ['luma-bottom-sheet__panel', this.isOpen() ? 'luma-bottom-sheet__panel--open' : '']
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
    if (this.drag.consumeDrag()) return;
    this.closed.emit();
  }
}
