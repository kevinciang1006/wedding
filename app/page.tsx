'use client';

import dynamic from 'next/dynamic';

// Konva requires `window`; nothing importing it may be reachable from a server component.
const Editor = dynamic(() => import('@/components/editor/Editor').then((m) => m.Editor), { ssr: false });

export default function Page() {
  return <Editor />;
}
