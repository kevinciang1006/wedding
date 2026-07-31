export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function rotatePoint(x: number, y: number, deg: number): { x: number; y: number } {
  if (deg === 0) return { x, y };
  const r = degToRad(deg);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}
