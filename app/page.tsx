'use client';

import dynamic from 'next/dynamic';

// Konva requires `window`; nothing importing it may be reachable from a server component.
const CanvasProbe = dynamic(() => import('@/components/canvas/CanvasProbe').then((m) => m.CanvasProbe), { ssr: false });

export default function Page() {
  return <main className="p-10"><CanvasProbe /></main>;
}
