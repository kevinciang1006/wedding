import { beforeEach, describe, expect, it } from 'vitest';
import { exportPng, type ExportStage, type VisibilityNode } from '@/lib/io/png';
import { useViewStore } from '@/stores/viewStore';

type MockOverlay = VisibilityNode & { log: boolean[] };

/**
 * A structural stand-in for the Overlay `Konva.Layer` — real overloaded
 * `visible()`/`visible(v)` behaviour (not a single optional-arg function),
 * so it satisfies `VisibilityNode` exactly the way a real Konva node does,
 * with no cast anywhere in this file.
 */
function makeOverlay(initiallyVisible: boolean): MockOverlay {
  let value = initiallyVisible;
  const log: boolean[] = [];
  function visible(): boolean;
  function visible(next: boolean): MockOverlay;
  function visible(next?: boolean) {
    if (next === undefined) return value;
    value = next;
    log.push(next);
    return overlay;
  }
  const overlay: MockOverlay = { visible, log };
  return overlay;
}

interface CaptureCall { x: number; y: number; width: number; height: number; pixelRatio: number }

interface MockStage {
  stage: ExportStage;
  calls: CaptureCall[];
}

/**
 * `x`/`y`/`scaleX`/`scaleY` stand in for a Stage panned/zoomed away from the
 * origin (10, 20 at 2x) specifically so the room-cm-to-pixel conversion
 * inside `exportPng` has something non-trivial to get right — at the
 * identity transform (0,0, scale 1) a bug that skipped the conversion
 * entirely would still pass.
 */
function makeStage(overlay: VisibilityNode | undefined, opts: {
  throwOnCapture?: boolean;
  dataUrl?: string;
  onCapture?: () => void;
} = {}): MockStage {
  const calls: CaptureCall[] = [];
  const stage: ExportStage = {
    findOne: () => overlay,
    x: () => 10,
    y: () => 20,
    scaleX: () => 2,
    scaleY: () => 2,
    toDataURL: (config) => {
      calls.push(config);
      opts.onCapture?.();
      if (opts.throwOnCapture) throw new Error('capture failed');
      return opts.dataUrl ?? 'data:image/png;base64,AAAA';
    },
  };
  return { stage, calls };
}

const ROOM = { width: 2200, height: 1400 };

describe('exportPng', () => {
  beforeEach(() => {
    useViewStore.getState().select([]);
  });

  it('converts the room cm bounds through the stage\'s live pan/zoom, not as already-pixels', () => {
    const overlay = makeOverlay(true);
    const { stage, calls } = makeStage(overlay);
    exportPng(stage, ROOM);
    expect(calls).toEqual([{ x: 10, y: 20, width: ROOM.width * 2, height: ROOM.height * 2, pixelRatio: 3 }]);
  });

  it('hides the overlay during capture and restores it after a successful export', () => {
    const overlay = makeOverlay(true);
    let visibleDuringCapture: boolean | null = null;
    const { stage } = makeStage(overlay, { onCapture: () => { visibleDuringCapture = overlay.visible(); } });
    const url = exportPng(stage, ROOM);
    expect(visibleDuringCapture).toBe(false);
    expect(overlay.visible()).toBe(true);
    expect(url).toBe('data:image/png;base64,AAAA');
  });

  it('restores the overlay even when toDataURL throws, and re-throws the original error', () => {
    const overlay = makeOverlay(true);
    const { stage } = makeStage(overlay, { throwOnCapture: true });
    expect(() => exportPng(stage, ROOM)).toThrow('capture failed');
    expect(overlay.visible()).toBe(true);
  });

  it('restores the overlay to its exact prior state, not just to visible', () => {
    // An overlay already hidden for some unrelated reason before export
    // starts must come back hidden, not be forced visible — `wasVisible` is
    // read, not assumed.
    const overlay = makeOverlay(false);
    const { stage } = makeStage(overlay);
    exportPng(stage, ROOM);
    expect(overlay.visible()).toBe(false);
  });

  it('never throws when no overlay layer is found', () => {
    const { stage } = makeStage(undefined);
    expect(() => exportPng(stage, ROOM)).not.toThrow();
  });

  it('clears the current selection during capture and restores it after a successful export', () => {
    useViewStore.getState().select(['t1', 't2']);
    let selectionDuringCapture: string[] | null = null;
    const { stage } = makeStage(makeOverlay(true), {
      onCapture: () => { selectionDuringCapture = useViewStore.getState().selectedIds; },
    });
    exportPng(stage, ROOM);
    expect(selectionDuringCapture).toEqual([]);
    expect(useViewStore.getState().selectedIds).toEqual(['t1', 't2']);
  });

  it('restores the selection even when the capture throws', () => {
    useViewStore.getState().select(['t1']);
    const { stage } = makeStage(makeOverlay(true), { throwOnCapture: true });
    expect(() => exportPng(stage, ROOM)).toThrow();
    expect(useViewStore.getState().selectedIds).toEqual(['t1']);
  });

  it('leaves the selection alone entirely when nothing was selected', () => {
    const before = useViewStore.getState().selectedIds;
    const { stage } = makeStage(makeOverlay(true));
    exportPng(stage, ROOM);
    // Same reference, not just an equal empty array — proves the no-op
    // branch (`previousSelection.length > 0`) actually short-circuits
    // rather than always calling `select([])`.
    expect(useViewStore.getState().selectedIds).toBe(before);
  });
});
