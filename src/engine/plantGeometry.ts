/**
 * Чиста геометрія для SVG-рослини: змішування кольорів, детермінований «шум», форми листків і вигин стебла.
 * Тут немає React і немає даних шкали BBCH: лише малювання. Розміри умовні (шкала їх не нормує).
 */
export interface Pt { x: number; y: number }

export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
export const clamp01 = (x: number): number => clamp(x, 0, 1);
const rad = (deg: number): number => (deg * Math.PI) / 180;
const r2 = (n: number): number => Math.round(n * 100) / 100;

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Змішує два кольори `#rrggbb` (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const k = clamp01(t);
  const A = toRgb(a), B = toRgb(b);
  return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * k).toString(16).padStart(2, '0')).join('');
}

/** Детермінований псевдовипадковий шум 0…1: малюнок не «стрибає» між перемальовуваннями. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const fmt = (p: Pt): string => `${r2(p.x)} ${r2(p.y)}`;

export function quad(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}
/** Кут дотичної в градусах від вертикалі (додатний — вправо). */
export function quadAngle(p0: Pt, p1: Pt, p2: Pt, t: number): number {
  const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/** Замкнений контур-«стрічка» навколо ламаної: half[i] — піввишина в точці i. */
export function ribbon(points: Pt[], half: number[]): string {
  const left: Pt[] = [], right: Pt[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    left.push({ x: p.x - dy * half[i], y: p.y + dx * half[i] });
    right.push({ x: p.x + dy * half[i], y: p.y - dx * half[i] });
  });
  return 'M' + [...left, ...right.reverse()].map(fmt).join('L') + 'Z';
}

export interface LeafShape { blade: string; rib: string; tip: Pt }

/**
 * Листкова пластинка пшениці: вузька, звужується до верхівки, вигинається вбік.
 * ang — початковий кут від вертикалі, bend — додатковий вигин (того ж знаку = звисає назовні).
 */
export function leafShape(x: number, y: number, ang: number, len: number, bend: number, width: number): LeafShape {
  const p0: Pt = { x, y };
  const p1: Pt = { x: x + Math.sin(rad(ang)) * len * 0.55, y: y - Math.cos(rad(ang)) * len * 0.55 };
  const p2: Pt = { x: p1.x + Math.sin(rad(ang + bend)) * len * 0.5, y: p1.y - Math.cos(rad(ang + bend)) * len * 0.5 };
  const N = 14;
  const pts: Pt[] = [], half: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(quad(p0, p1, p2, t));
    const prof = t < 0.28 ? 0.45 + 0.55 * Math.sin((t / 0.28) * (Math.PI / 2)) : Math.max(0, 1 - Math.pow((t - 0.28) / 0.72, 1.25));
    half.push((width / 2) * prof);
  }
  return { blade: ribbon(pts, half), rib: 'M' + pts.slice(0, N).map(fmt).join('L'), tip: p2 };
}

/** Стебло (соломина): квадратична крива від основи до верхівки; reach — зміщення верхівки по горизонталі. */
export interface Culm { x0: number; y0: number; h: number; reach: number }
const culmCtl = (c: Culm): [Pt, Pt, Pt] => [
  { x: c.x0, y: c.y0 },
  { x: c.x0 + c.reach * 0.12, y: c.y0 - c.h * 0.55 },
  { x: c.x0 + c.reach, y: c.y0 - c.h },
];
export const culmPoint = (c: Culm, t: number): Pt => { const [a, b, d] = culmCtl(c); return quad(a, b, d, t); };
export const culmAngle = (c: Culm, t: number): number => { const [a, b, d] = culmCtl(c); return quadAngle(a, b, d, t); };
export function culmPoints(c: Culm, t0: number, t1: number, n: number): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => culmPoint(c, t0 + ((t1 - t0) * i) / n));
}
