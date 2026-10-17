import {
  DRAG_SLOP_PX,
  type PointerSample,
  resolveSheetDrag,
  sampleVelocity,
  sheetDragOffset,
} from './sheet-drag.util';

const DRAGGING_CLASS = 'luma-bottom-sheet__panel--dragging';
const RETURNING_CLASS = 'luma-bottom-sheet__panel--returning';

/**
 * SheetDrag — drag-down-to-close for LumaBottomSheet with pointer events.
 * The panel follows the finger (transform only, will-change while dragging),
 * then closes or springs back depending on distance and speed.
 */
export class SheetDrag {
  private start: PointerSample | null = null;
  private previous: PointerSample | null = null;
  private latest: PointerSample | null = null;
  private moved = false;

  constructor(
    private readonly panel: () => HTMLElement,
    private readonly close: () => void,
  ) {}

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.start = this.previous = this.latest = { y: event.clientY, time: event.timeStamp };
    this.moved = false;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.start) return;
    const delta = event.clientY - this.start.y;
    if (!this.moved && Math.abs(delta) < DRAG_SLOP_PX) return;
    if (!this.moved) {
      this.moved = true;
      this.panel().classList.add(DRAGGING_CLASS);
    }
    this.previous = this.latest;
    this.latest = { y: event.clientY, time: event.timeStamp };
    this.panel().style.transform = `translateY(${sheetDragOffset(delta)}px)`;
  }

  onPointerUp(): void {
    if (!this.start || !this.latest || !this.previous) return;
    const wasDragging = this.moved;
    const offsetPx = sheetDragOffset(this.latest.y - this.start.y);
    const velocityPxPerMs = sampleVelocity(this.previous, this.latest);
    this.start = null;
    if (!wasDragging) return;

    const panel = this.panel();
    panel.classList.remove(DRAGGING_CLASS);
    const outcome = resolveSheetDrag({
      offsetPx,
      velocityPxPerMs,
      sheetHeightPx: panel.offsetHeight,
    });
    if (outcome === 'close') {
      // Keep going down from where the finger left it; reset() clears it on reopen.
      panel.style.transform = 'translateY(100%)';
      this.close();
      return;
    }
    panel.classList.add(RETURNING_CLASS);
    panel.style.transform = '';
    panel.addEventListener('transitionend', () => panel.classList.remove(RETURNING_CLASS), {
      once: true,
    });
  }

  /** Clears any position left by a previous drag (call when the sheet opens). */
  reset(): void {
    const panel = this.panel();
    panel.style.transform = '';
    panel.classList.remove(DRAGGING_CLASS, RETURNING_CLASS);
  }

  /** True once after a drag, so the click that follows it is ignored. */
  consumeDrag(): boolean {
    const dragged = this.moved;
    this.moved = false;
    return dragged;
  }
}
