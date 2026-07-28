export type Cm = number;

export type ObjectType =
  | 'roundTable' | 'rectTable' | 'sweetheart' | 'headTable'
  | 'danceFloor' | 'stage' | 'bar' | 'buffet' | 'label' | 'rect';

interface ObjectBase {
  id: string;
  x: Cm;            // centre point
  y: Cm;            // centre point
  rotation: number; // degrees, clockwise
  label: string;
  z: number;
}

export interface RoundTable extends ObjectBase { type: 'roundTable'; diameter: Cm; seatCount: number; }
export interface RectTable extends ObjectBase { type: 'rectTable'; width: Cm; height: Cm; seatsPerSide: number; }
export interface Sweetheart extends ObjectBase { type: 'sweetheart'; width: Cm; height: Cm; }
export interface HeadTable extends ObjectBase { type: 'headTable'; width: Cm; height: Cm; seatCount: number; }
export interface PropRect extends ObjectBase { type: 'danceFloor' | 'stage' | 'bar' | 'buffet' | 'rect'; width: Cm; height: Cm; }
export interface TextLabel extends ObjectBase { type: 'label'; fontSize: number; }

export type SceneObject = RoundTable | RectTable | Sweetheart | HeadTable | PropRect | TextLabel;
export type TableObject = RoundTable | RectTable | Sweetheart | HeadTable;

export function isTable(obj: SceneObject): obj is TableObject {
  return obj.type === 'roundTable' || obj.type === 'rectTable'
    || obj.type === 'sweetheart' || obj.type === 'headTable';
}

export function hasBox(obj: SceneObject): obj is RectTable | Sweetheart | HeadTable | PropRect {
  return obj.type !== 'roundTable' && obj.type !== 'label';
}

export type Rsvp = 'yes' | 'no' | 'pending';

export interface Guest {
  id: string;
  name: string;
  group: string | null;
  dietary: string | null;   // short code shown as a badge: GF, VG, DF, NUT
  rsvp: Rsvp;
  plusOneOf: string | null;
}

export type Units = 'm' | 'ft';

export interface Doc {
  version: 1;
  title: string;
  eventDate: string | null;          // ISO yyyy-mm-dd
  room: { width: Cm; height: Cm };
  units: Units;
  objects: Record<string, SceneObject>;
  objectOrder: string[];             // z-order, back to front
  guests: Record<string, Guest>;
  guestOrder: string[];
  seatAssignments: Record<string, string>;  // seatId -> guestId
}
