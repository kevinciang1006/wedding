'use client';

import { Layer } from 'react-konva';
import { Marquee } from '@/components/canvas/Marquee';
import { AlignmentGuides } from '@/components/canvas/AlignmentGuides';
import { LiveDistance } from '@/components/canvas/LiveDistance';
import { DuplicateGhosts } from '@/components/canvas/DuplicateGhosts';
import { SelectionTransformer } from '@/components/canvas/SelectionTransformer';

/**
 * Topmost layer: the marquee rect, alignment guides (+ their snap labels),
 * the live drag-distance tape measure, the Option-drag duplicate-preview
 * ghosts, and the selection Transformer. No `listening={false}` here, unlike
 * Static/Objects — `listening` cascades to descendants in Konva's
 * hit-testing, and the Transformer's own anchors genuinely need to receive
 * pointer events to be draggable at all. `Marquee`, `AlignmentGuides`,
 * `LiveDistance` and `DuplicateGhosts` opt their own shapes out individually
 * instead.
 *
 * `name="overlay-layer"` is a Konva selector, not a CSS one — it's how
 * `lib/io/png.ts`'s PNG export finds and hides this exact layer by name
 * (`stage.findOne('.overlay-layer')`) rather than assuming it's always the
 * Stage's last child.
 */
export function OverlayLayer() {
  return (
    <Layer name="overlay-layer">
      <Marquee />
      <AlignmentGuides />
      <LiveDistance />
      <DuplicateGhosts />
      <SelectionTransformer />
    </Layer>
  );
}
