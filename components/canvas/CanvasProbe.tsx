'use client';

import { Stage, Layer, Rect } from 'react-konva';

export function CanvasProbe() {
  return (
    <Stage width={400} height={300}>
      <Layer>
        <Rect x={20} y={20} width={360} height={260} fill="#ffffff" stroke="#2b343a" strokeWidth={2} />
      </Layer>
    </Stage>
  );
}
