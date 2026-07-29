'use client';

import { memo } from 'react';
import { Text } from 'react-konva';
import { useDocStore } from '@/stores/docStore';
import { useObjectDrag } from '@/components/canvas/useObjectDrag';
import { getBounds, isOutsideRoom, localExtents } from '@/lib/geometry/bounds';
import { INK, canvasNameFont } from '@/lib/canvasTokens';
import { OUTSIDE_ROOM_OPACITY } from '@/lib/constants';

interface LabelNodeProps { id: string }

/**
 * A bare text label has no box of its own — `localExtents` (built for
 * snapping/selection in Task 4) already approximates one from the font size
 * and character count, so centring here reuses that instead of inventing a
 * second, possibly-inconsistent estimate.
 *
 * `useObjectDrag(id)`'s handlers attach directly to this `Text`, not to a
 * wrapping `Group` — unlike Table/PropNode there is no sibling content that
 * would need one, and `Text` is itself a real Konva Shape the Transformer
 * can resize. A label has no stored width/height (only `fontSize`); its
 * resize handling (`SelectionTransformer`'s `transformEnd`) folds
 * `scaleY` into a new `fontSize` instead, and resets scale to 1 here after,
 * same convention as Table/PropNode.
 */
export const LabelNode = memo(function LabelNode({ id }: LabelNodeProps) {
  const obj = useDocStore((s) => s.objects[id]);
  const room = useDocStore((s) => s.room);
  const drag = useObjectDrag(id);

  if (!obj || obj.type !== 'label') return null;

  const opacity = isOutsideRoom(getBounds(obj), room) ? OUTSIDE_ROOM_OPACITY : 1;
  const { hw, hh } = localExtents(obj);

  return (
    <Text
      id={obj.id}
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation}
      scaleX={1}
      scaleY={1}
      opacity={opacity}
      text={obj.label}
      fontFamily={canvasNameFont()}
      fontSize={obj.fontSize}
      fill={INK}
      width={hw * 2}
      height={hh * 2}
      offsetX={hw}
      offsetY={hh}
      align="center"
      verticalAlign="middle"
      wrap="none"
      draggable={drag.draggable}
      onMouseDown={drag.onMouseDown}
      onClick={drag.onClick}
      onContextMenu={drag.onContextMenu}
      onDragStart={drag.onDragStart}
      onDragMove={drag.onDragMove}
      onDragEnd={drag.onDragEnd}
    />
  );
});
