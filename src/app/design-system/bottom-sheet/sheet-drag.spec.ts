import { describe, expect, it, vi } from 'vitest';
import { SheetDrag } from './sheet-drag';
import {
  FLING_VELOCITY,
  MIN_FLING_DISTANCE_PX,
  OVERDRAG_RESISTANCE,
  resolveSheetDrag,
  sampleVelocity,
  sheetDragOffset,
} from './sheet-drag.util';

const HEIGHT = 400;

describe('resolveSheetDrag', () => {
  it('closes when dragged past 30% of the height, however slowly', () => {
    expect(resolveSheetDrag({ offsetPx: 120, velocityPxPerMs: 0, sheetHeightPx: HEIGHT })).toBe(
      'close',
    );
  });

  it('springs back from a short, slow drag', () => {
    expect(resolveSheetDrag({ offsetPx: 100, velocityPxPerMs: 0.1, sheetHeightPx: HEIGHT })).toBe(
      'restore',
    );
  });

  it('closes on a fast flick once it moved the minimum distance', () => {
    const fling = { velocityPxPerMs: FLING_VELOCITY, sheetHeightPx: HEIGHT };
    expect(resolveSheetDrag({ ...fling, offsetPx: MIN_FLING_DISTANCE_PX })).toBe('close');
    expect(resolveSheetDrag({ ...fling, offsetPx: MIN_FLING_DISTANCE_PX - 1 })).toBe('restore');
  });

  it('never closes when dragged upwards', () => {
    expect(resolveSheetDrag({ offsetPx: -50, velocityPxPerMs: 2, sheetHeightPx: HEIGHT })).toBe(
      'restore',
    );
  });
});

describe('sheetDragOffset and sampleVelocity', () => {
  it('follows the finger down and resists upwards (elastic)', () => {
    expect(sheetDragOffset(80)).toBe(80);
    expect(sheetDragOffset(-80)).toBe(-80 * OVERDRAG_RESISTANCE);
  });

  it('measures px/ms between samples and ignores zero elapsed time', () => {
    expect(sampleVelocity({ y: 0, time: 0 }, { y: 50, time: 100 })).toBe(0.5);
    expect(sampleVelocity({ y: 0, time: 5 }, { y: 50, time: 5 })).toBe(0);
  });
});

describe('SheetDrag', () => {
  function pointer(clientY: number, timeStamp: number): PointerEvent {
    return { button: 0, clientY, timeStamp, pointerId: 1, currentTarget: null } as unknown as PointerEvent;
  }

  function setup() {
    const panel = document.createElement('div');
    Object.defineProperty(panel, 'offsetHeight', { value: HEIGHT });
    const close = vi.fn();
    return { panel, close, drag: new SheetDrag(() => panel, close) };
  }

  it('moves the panel while dragging and closes past the threshold', () => {
    const { panel, close, drag } = setup();
    drag.onPointerDown(pointer(0, 0));
    drag.onPointerMove(pointer(200, 400));
    expect(panel.style.transform).toBe('translateY(200px)');
    expect(panel.classList).toContain('luma-bottom-sheet__panel--dragging');

    drag.onPointerUp();
    expect(close).toHaveBeenCalledOnce();
    expect(panel.classList).not.toContain('luma-bottom-sheet__panel--dragging');
    expect(drag.consumeDrag()).toBe(true);
  });

  it('springs back from a short drag and leaves no inline position', () => {
    const { panel, close, drag } = setup();
    drag.onPointerDown(pointer(0, 0));
    drag.onPointerMove(pointer(40, 400));
    drag.onPointerUp();

    expect(close).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('');
    expect(panel.classList).toContain('luma-bottom-sheet__panel--returning');
  });

  it('treats a press without movement as a tap, not a drag', () => {
    const { panel, close, drag } = setup();
    drag.onPointerDown(pointer(0, 0));
    drag.onPointerMove(pointer(3, 10));
    drag.onPointerUp();

    expect(panel.style.transform).toBe('');
    expect(close).not.toHaveBeenCalled();
    expect(drag.consumeDrag()).toBe(false);
  });
});
