import type { Cm, ObjectType, SceneObject } from '@/lib/types/doc';

let counter = 0;

function nextId(type: ObjectType): string {
  counter += 1;
  return `${type}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

const LABELS: Record<ObjectType, string> = {
  roundTable: 'table', rectTable: 'banquet table', sweetheart: 'sweetheart table',
  headTable: 'head table', danceFloor: 'dance floor', stage: 'stage',
  bar: 'bar', buffet: 'buffet', label: 'text', rect: 'area',
};

export function createObject(type: ObjectType, at: { x: Cm; y: Cm }, z = 0): SceneObject {
  const base = { id: nextId(type), x: at.x, y: at.y, rotation: 0, label: LABELS[type], z };
  switch (type) {
    case 'roundTable':  return { ...base, type, diameter: 180, seatCount: 10 };
    case 'rectTable':   return { ...base, type, width: 240, height: 90, seatsPerSide: 4 };
    case 'sweetheart':  return { ...base, type, width: 150, height: 75 };
    case 'headTable':   return { ...base, type, width: 480, height: 90, seatCount: 8 };
    case 'danceFloor':  return { ...base, type, width: 500, height: 400 };
    case 'stage':       return { ...base, type, width: 400, height: 200 };
    case 'bar':         return { ...base, type, width: 300, height: 80 };
    case 'buffet':      return { ...base, type, width: 360, height: 80 };
    case 'rect':        return { ...base, type, width: 200, height: 120 };
    case 'label':       return { ...base, type, fontSize: 40 };
  }
}
