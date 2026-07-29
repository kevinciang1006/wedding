'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';
import { duplicateSelection, deleteSelection } from '@/components/canvas/useKeyboard';
import { isTable } from '@/lib/types/doc';

/** Single-step reorder: swaps `targetId` with its immediate neighbour in z-order. */
function bringForward(targetId: string): void {
  useDocStore.getState().commit((d) => {
    const order = d.objectOrder;
    const i = order.indexOf(targetId);
    if (i === -1 || i === order.length - 1) return;
    [order[i], order[i + 1]] = [order[i + 1], order[i]];
  }, 'bring forward');
}

function sendBackward(targetId: string): void {
  useDocStore.getState().commit((d) => {
    const order = d.objectOrder;
    const i = order.indexOf(targetId);
    if (i <= 0) return;
    [order[i], order[i - 1]] = [order[i - 1], order[i]];
  }, 'send backward');
}

interface MenuItemProps { label: string; onSelect: () => void }

function MenuItem({ label, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="block w-full px-3 py-1.5 text-left text-[12.5px] text-ink hover:bg-cool-tint hover:text-cool-deep"
    >
      {label}
    </button>
  );
}

/**
 * Right-click menu: bring forward, send backward, duplicate, delete, and —
 * for tables — a "seat a group here" list over the distinct `group` values
 * across `doc.guests`. Plain HTML, not a Konva overlay: it's positioned at
 * the native click's screen (client) coordinates, as a sibling of
 * `CanvasStage` rather than inside the Stage, since text layout and hover
 * states are free here and would each need hand-rolling on canvas.
 *
 * `useKeyboard.ts`'s `duplicateSelection`/`deleteSelection` are reused
 * as-is, not reimplemented: `useObjectDrag`'s own `onContextMenu` always
 * replaces the selection with exactly the right-clicked object before this
 * opens, so those selection-driven helpers already operate on the one
 * object this menu is for. Bring-forward/send-backward act on
 * `menu.targetId` directly instead, since "forward/backward" is a
 * single-object's position in `objectOrder`, not something that
 * generalises cleanly to an arbitrary selection.
 */
export function ContextMenu() {
  const menu = useViewStore((s) => s.contextMenu);
  const close = useViewStore((s) => s.closeContextMenu);
  const t = useT();
  const target = useDocStore((s) => (menu ? s.objects[menu.targetId] : undefined));
  const groups = useDocStore(useShallow((s) => (
    [...new Set(Object.values(s.guests).map((g) => g.group).filter((g): g is string => g !== null))]
  )));

  // Any pointer-down outside the menu closes it. Only registered while
  // open; stopped from ever seeing the click that opened it because that
  // mousedown has already finished dispatching by the time this effect
  // runs (contextmenu fires after mousedown/mouseup, not during them).
  useEffect(() => {
    if (!menu) return;
    function handlePointerDown(): void {
      close();
    }
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [menu, close]);

  if (!menu || !target) return null;

  function run(action: () => void): void {
    action();
    close();
  }

  return (
    <div
      className="fixed z-50 w-52 border border-panel-border bg-paper py-1 font-[family-name:var(--font-ui)] shadow-screen"
      style={{ left: menu.x, top: menu.y }}
      // Stop this click from reaching the window-level backdrop listener
      // above — otherwise choosing an item would close the menu before its
      // own onClick ever fired.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MenuItem label={t('bringForward')} onSelect={() => run(() => bringForward(menu.targetId))} />
      <MenuItem label={t('sendBackward')} onSelect={() => run(() => sendBackward(menu.targetId))} />
      <div className="my-1 border-t border-hairline" />
      <MenuItem label={t('duplicate')} onSelect={() => run(duplicateSelection)} />
      <MenuItem label={t('delete')} onSelect={() => run(deleteSelection)} />
      {isTable(target) && groups.length > 0 && (
        <>
          <div className="my-1 border-t border-hairline" />
          <div className="px-3 py-1 font-[family-name:var(--font-data)] text-[10px] uppercase tracking-wide text-text-muted">
            {t('seatGroupHere')}
          </div>
          {groups.map((group) => (
            <MenuItem
              key={group}
              label={group}
              onSelect={() => run(() => useDocStore.getState().seatGroupAt(menu.targetId, group))}
            />
          ))}
        </>
      )}
    </div>
  );
}
