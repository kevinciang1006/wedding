'use client';

import { Layer } from 'react-konva';
import { Marquee } from '@/components/canvas/Marquee';
import { AlignmentGuides } from '@/components/canvas/AlignmentGuides';
import { LiveDistance } from '@/components/canvas/LiveDistance';
import { SelectionTransformer } from '@/components/canvas/SelectionTransformer';

/**
 * Topmost layer: the marquee rect, alignment guides (+ their snap labels),
 * the live drag-distance tape measure, and the selection Transformer. No
 * `listening={false}` here, unlike Static/Objects — `listening` cascades to
 * descendants in Konva's hit-testing, and the Transformer's own anchors
 * genuinely need to receive pointer events to be draggable at all.
 * `Marquee`, `AlignmentGuides` and `LiveDistance` opt their own shapes out
 * individually instead.
 */
export function OverlayLayer() {
  return (
    <Layer>
      <Marquee />
      <AlignmentGuides />
      <LiveDistance />
      <SelectionTransformer />
    </Layer>
  );
}
