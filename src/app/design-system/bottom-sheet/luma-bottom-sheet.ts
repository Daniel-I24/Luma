import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  type OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BackNavigation } from '@core/navigation/back-navigation';
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
export class LumaBottomSheet implements OnDestroy {
  public readonly open = input<boolean>(false);
  public readonly title = input<string | undefined>(undefined);
  public readonly titleId = input<string>('bottom-sheet-title');
  /** Id of a heading inside the projected content, used when there is no title. */
  public readonly ariaLabelledBy = input<string | null>(null);
  public readonly closeOnOverlay = input<boolean>(true);

  public readonly closed = output<void>();

  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private returnFocusTo: HTMLElement | null = null;
  private readonly back = inject(BackNavigation);
  /** While open, the phone's or the browser's back closes the sheet first. */
  private releaseBack: (() => void) | null = null;

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
        this.releaseBack ??= this.back.openLayer(() => this.closed.emit());
        this.drag.reset();
        this.returnFocusTo = this.document.activeElement as HTMLElement | null;
        afterNextRender(() => this.panel().nativeElement.focus(), { injector: this.injector });
      } else {
        this.releaseBack?.();
        this.releaseBack = null;
        this.returnFocusTo?.focus();
        this.returnFocusTo = null;
      }
    });
  }

  /** Leaving the screen with the sheet open lets the history go with it. */
  public ngOnDestroy(): void {
    this.releaseBack?.();
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
