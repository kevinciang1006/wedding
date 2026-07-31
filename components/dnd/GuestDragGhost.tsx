'use client';

import { useDocStore } from '@/stores/docStore';
import { useGuestDrag } from '@/components/dnd/useGuestDrag';

/**
 * The chip that follows the cursor while a guest is being dragged — a
 * `position: fixed` sibling of the canvas and the guest panel, not a Konva
 * node (the drag can end over either surface) and not the real `GuestChip`
 * (that one stays mounted in the list, showing the `movingTo` placeholder
 * instead — see its own header comment). `pointer-events-none` throughout:
 * this element must never itself become the thing a pointermove/pointerup
 * hit-tests against.
 *
 * Reads `viewStore.guestDrag` via `useGuestDrag()`, which is `null` until
 * the gesture arms (`startGuestDrag`'s `GUEST_DRAG_ARM_PX` threshold), so
 * this renders nothing for a plain click — never mounts a ghost that has to
 * be told to disappear again.
 */
export function GuestDragGhost() {
  const { dragging } = useGuestDrag();
  const guest = useDocStore((s) => (dragging ? s.guests[dragging.guestId] : undefined));

  if (!dragging || !guest) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 flex h-8 max-w-52 items-center gap-2 border border-cool bg-paper px-2 shadow-drag-lg"
      style={{
        left: dragging.x,
        top: dragging.y,
        transform: 'translate(-50%, -50%) rotate(-2deg)',
      }}
    >
      <span className="min-w-0 truncate font-[family-name:var(--font-name)] text-[12.5px] text-ink">
        {guest.name}
      </span>
    </div>
  );
}
