/** Fraction of the sheet height that closes it when released past it. */
const CLOSE_DISTANCE_FRACTION = 0.3;
/** Downward speed (px/ms) that closes the sheet as a flick… */
export const FLING_VELOCITY = 0.5;
/** …once it moved at least this far, so a tap never closes it. */
export const MIN_FLING_DISTANCE_PX = 24;
/** Pulling up past the open position moves the sheet this fraction (elastic). */
export const OVERDRAG_RESISTANCE = 0.25;
/** Movement that turns a press on the handle into a drag (no click). */
export const DRAG_SLOP_PX = 6;

/** A flicked sheet keeps the finger's speed, within the motion range for screens (ms). */
const FLING_MIN_MS = 120;
const FLING_MAX_MS = 340;

/** SheetDragMath — offsets, velocity and the release decision of a dragged sheet. */
export class SheetDragMath {
  /** Time to travel the rest of the way at the release speed (inertia), clamped. */
  public static flingDurationMs(remainingPx: number, velocityPxPerMs: number): number {
    if (velocityPxPerMs <= 0) return FLING_MAX_MS;
    return Math.round(Math.min(FLING_MAX_MS, Math.max(FLING_MIN_MS, remainingPx / velocityPxPerMs)));
  }

  /** Decides whether a released drag closes the sheet or springs it back. */
  public static resolveSheetDrag({
    offsetPx,
    velocityPxPerMs,
    sheetHeightPx,
  }: SheetDragRelease): SheetDragOutcome {
    if (offsetPx <= 0) return 'restore';
    if (offsetPx >= sheetHeightPx * CLOSE_DISTANCE_FRACTION) return 'close';
    if (velocityPxPerMs >= FLING_VELOCITY && offsetPx >= MIN_FLING_DISTANCE_PX) return 'close';
    return 'restore';
  }

  /** Visual offset for a pointer delta: 1:1 downwards, resisted upwards. */
  public static sheetDragOffset(deltaPx: number): number {
    return deltaPx >= 0 ? deltaPx : deltaPx * OVERDRAG_RESISTANCE;
  }

  /** Speed between the two latest samples (px/ms); 0 when time did not advance. */
  public static sampleVelocity(previous: PointerSample, latest: PointerSample): number {
    const elapsed = latest.time - previous.time;
    return elapsed > 0 ? (latest.y - previous.y) / elapsed : 0;
  }
}

export type SheetDragOutcome = 'close' | 'restore';

export interface SheetDragRelease {
  /** How far down the sheet was dragged (px, negative = up). */
  offsetPx: number;
  /** Downward speed at release (px/ms). */
  velocityPxPerMs: number;
  sheetHeightPx: number;
}

export interface PointerSample {
  y: number;
  time: number;
}
