'use client';

import { CanvasStage } from '@/components/canvas/CanvasStage';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { useViewport } from '@/components/canvas/useViewport';
import { useKeyboard } from '@/components/canvas/useKeyboard';

/**
 * The client root. Only the canvas (plus the right-click menu) exists yet;
 * the flex shell below is shaped so later tasks can add a 52 px top bar as
 * the first child of the outer column, a 200 px left palette as the first
 * child of the row, and a 320 px right guest panel as its last child — all
 * without restructuring this component.
 *
 * `useViewport` is called exactly once, here, because its `fitToRoom` /
 * `resetZoom` / `zoomBy` close over the Konva stage and container refs:
 * calling the hook a second place (e.g. inside a future top bar) would
 * create a second, never-attached set of refs. Everything that needs the
 * viewport — the canvas now, chrome later — receives this one instance.
 *
 * `useKeyboard` (selection/object shortcuts) is called here too, rather
 * than composed inside `useViewport`, because unlike `useMarquee` it needs
 * neither the Stage nor the container ref — it only ever reads store state
 * via `getState()`. `ContextMenu` is plain HTML, a sibling of the canvas
 * rather than something inside the Konva `Stage`.
 */
export function Editor() {
  const viewport = useViewport();
  useKeyboard();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <CanvasStage viewport={viewport} />
        </div>
      </div>
      <ContextMenu />
    </div>
  );
}
