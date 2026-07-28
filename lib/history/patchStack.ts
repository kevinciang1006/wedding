import type { Patch } from 'immer';
import { HISTORY_CAP } from '@/lib/constants';

export interface HistoryEntry {
  patches: Patch[];
  inversePatches: Patch[];
  label: string;
}

export class PatchStack {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];

  push(entry: HistoryEntry): void {
    this.past.push(entry);
    if (this.past.length > HISTORY_CAP) this.past.shift();
    this.future = [];
  }

  undo(): HistoryEntry | null {
    const entry = this.past.pop();
    if (!entry) return null;
    this.future.push(entry);
    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.future.pop();
    if (!entry) return null;
    this.past.push(entry);
    return entry;
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  get undoLabel(): string | null { return this.past[this.past.length - 1]?.label ?? null; }
  get redoLabel(): string | null { return this.future[this.future.length - 1]?.label ?? null; }

  clear(): void { this.past = []; this.future = []; }
}
