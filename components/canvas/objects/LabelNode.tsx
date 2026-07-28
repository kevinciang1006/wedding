'use client';

import { memo } from 'react';
import { Text } from 'react-konva';
import { useDocStore } from '@/stores/docStore';
import { getBounds, isOutsideRoom, localExtents } from '@/lib/geometry/bounds';
import { INK, canvasNameFont } from '@/lib/canvasTokens';
import { OUTSIDE_ROOM_OPACITY } from '@/lib/constants';

interface LabelNodeProps { id: string }

/**
 * A bare text label has no box of its own — `localExtents` (built for
 * snapping/selection in Task 4) already approximates one from the font size
 * and character count, so centring here reuses that instead of inventing a
 * second, possibly-inconsistent estimate.
 */
export const LabelNode = memo(function LabelNode({ id }: LabelNodeProps) {
  const obj = useDocStore((s) => s.objects[id]);
  const room = useDocStore((s) => s.room);

  if (!obj || obj.type !== 'label') return null;

  const opacity = isOutsideRoom(getBounds(obj), room) ? OUTSIDE_ROOM_OPACITY : 1;
  const { hw, hh } = localExtents(obj);

  return (
    <Text
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation}
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
    />
  );
});
