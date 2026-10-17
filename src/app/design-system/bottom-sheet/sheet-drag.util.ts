/** Fraction of the sheet height that closes it when released past it. */
export const CLOSE_DISTANCE_FRACTION = 0.3;
/** Downward speed (px/ms) that closes the sheet as a flick… */
export const FLING_VELOCITY = 0.5;
/** …once it moved at least this far, so a tap never closes it. */
export const MIN_FLING_DISTANCE_PX = 24;
/** Pulling up past the open position moves the sheet this fraction (elastic). */
export const OVERDRAG_RESISTANCE = 0.25;
/** Movement that turns a press on the handle into a drag (no click). */
export const DRAG_SLOP_PX = 6;

export type SheetDragOutcome = 'close' | 'restore';

export interface SheetDragRelease {
  /** How far down the sheet was dragged (px, negative = up). */
  offsetPx: number;
  /** Downward speed at release (px/ms). */
  velocityPxPerMs: number;
  sheetHeightPx: number;
}

/** Decides whether a released drag closes the sheet or springs it back. */
export function resolveSheetDrag({
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
export function sheetDragOffset(deltaPx: number): number {
  return deltaPx >= 0 ? deltaPx : deltaPx * OVERDRAG_RESISTANCE;
}

export interface PointerSample {
  y: number;
  time: number;
}

/** Speed between the two latest samples (px/ms); 0 when time did not advance. */
export function sampleVelocity(previous: PointerSample, latest: PointerSample): number {
  const elapsed = latest.time - previous.time;
  return elapsed > 0 ? (latest.y - previous.y) / elapsed : 0;
}
