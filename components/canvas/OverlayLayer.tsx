'use client';

import { Layer } from 'react-konva';
import { Marquee } from '@/components/canvas/Marquee';
import { AlignmentGuides } from '@/components/canvas/AlignmentGuides';
import { SelectionTransformer } from '@/components/canvas/SelectionTransformer';

/**
 * Topmost layer: the marquee rect, alignment guides, and the selection
 * Transformer. No `listening={false}` here, unlike Static/Objects —
 * `listening` cascades to descendants in Konva's hit-testing, and the
 * Transformer's own anchors genuinely need to receive pointer events to be
 * draggable at all. `Marquee` and `AlignmentGuides` opt their own shapes
 * out individually instead.
 */
export function OverlayLayer() {
  return (
    <Layer>
      <Marquee />
      <AlignmentGuides />
      <SelectionTransformer />
    </Layer>
  );
}
