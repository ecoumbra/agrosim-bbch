/**
 * Параметрична модель озимої пшениці для візуалізації фази BBCH.
 * Кожен параметр виведено з визначень шкали зернових (кількість листків 11–19, пагонів кущіння 21–29,
 * вузли 31–33 з мінімальними відстанями, частка колоса 51–59, пиляки 61–69, молочна/тістоподібна стадії).
 * Величини, яких шкала не нормує (висота, розмір листків), — умовні, суто для малюнка.
 */
export interface PlantModel {
  code: number;
  imbibition: number; radicle: number; coleoptile: number; roots: number;
  emerged: boolean;
  leaves: number; leafGrow: number; tillers: number; tillersDrawn: number;
  stem: number; nodes: number; flagLeaf: 'none' | 'rolled' | 'open';
  boot: number; sheathOpen: boolean; awns: boolean;
  head: number; anthers: number; dryAnthers: number;
  grain: number; ripe: number; senescence: number; shedding: number;
  lodged: boolean; harvested: boolean;
  growingPoint: 'below' | 'rising' | 'ear';
  /** Мінімальна відстань (см) від вузла кущіння: верхівка зачатка колоса (30) або вузли 1–3 (31–33). */
  nodeMinCm: number[]; primordiumMinCm: number | null;
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** Лінійна інтерполяція за таблицею [код, значення]; поза межами — крайні значення. */
function table(code: number, pts: [number, number][]): number {
  if (code <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (code <= pts[i][0]) { const [c0, v0] = pts[i - 1], [c1, v1] = pts[i]; return v0 + ((v1 - v0) * (code - c0)) / (c1 - c0); }
  }
  return pts[pts.length - 1][1];
}

export function plantModel(code: number): PlantModel {
  const c = clamp(Math.round(code), 0, 99);
  // 19 = «9 і більше листків»: далі кількість розгорнутих листків головного пагона не зменшується (прапорцевий лист — окремий параметр flagLeaf)
  const leaves = c < 10 ? 0 : c < 20 ? c - 10 : 9;
  const tillers = c >= 21 && c <= 29 ? c - 20 : c >= 30 && c < 90 ? 9 : 0;
  const nodes = c < 31 ? 0 : Math.min(4, c - 30 + (c > 33 ? 1 : 0));
  const stem = table(c, [[29, 0], [30, 0.1], [31, 0.2], [32, 0.3], [33, 0.4], [37, 0.75], [39, 0.9], [41, 0.92], [49, 1]]);
  const head = c < 51 ? 0 : c >= 59 ? 1 : c === 51 ? 0.06 : (c - 50) / 10;
  return {
    code: c,
    imbibition: c === 0 ? 0 : c === 1 ? 0.35 : 1,
    radicle: c < 5 ? 0 : table(c, [[5, 0.25], [6, 0.6], [7, 0.8], [9, 1]]),
    coleoptile: c < 7 ? 0 : table(c, [[7, 0.5], [9, 1]]),
    roots: c < 5 ? 0 : table(c, [[5, 0.1], [9, 0.3], [19, 0.55], [29, 0.7], [39, 0.85], [59, 1]]),
    emerged: c >= 9,
    leaves, leafGrow: c === 10 ? 0.6 : 0,
    tillers, tillersDrawn: Math.min(5, tillers),
    stem, nodes, flagLeaf: c < 37 ? 'none' : c < 39 ? 'rolled' : 'open',
    boot: c < 41 || c >= 51 ? 0 : table(c, [[41, 0.25], [43, 0.5], [45, 0.85], [47, 1]]),
    sheathOpen: c >= 47, awns: c >= 49,
    head,
    anthers: c < 61 || c > 69 ? 0 : table(c, [[61, 0.25], [65, 1], [69, 0.35]]),
    dryAnthers: c >= 69 && c < 90 ? 1 : 0,
    grain: c < 71 ? 0 : table(c, [[71, 0.5], [73, 0.75], [75, 1]]),
    ripe: c < 71 ? 0 : c < 78 ? table(c, [[71, 0], [77, 0.1]]) : table(c, [[77, 0.1], [83, 0.25], [85, 0.4], [87, 0.65], [89, 1]]),
    senescence: c < 71 ? 0 : table(c, [[71, 0.1], [75, 0.25], [77, 0.35], [83, 0.5], [85, 0.6], [87, 0.8], [89, 1]]),
    shedding: c < 92 ? 0 : table(c, [[92, 0.3], [93, 0.7], [97, 1]]),
    lodged: c >= 97, harvested: c === 99,
    growingPoint: c < 30 ? 'below' : c < 37 ? 'rising' : 'ear',
    nodeMinCm: c >= 31 && c <= 33 ? [1, 3, 5].slice(0, c - 30) : [],
    primordiumMinCm: c === 30 ? 1 : null,
  };
}

/** Інтерполяція моделей для плавної анімації між фазами. */
export function lerpModel(a: PlantModel, b: PlantModel, t: number): PlantModel {
  const out = { ...b } as unknown as Record<string, unknown>;
  const A = a as unknown as Record<string, unknown>;
  const B = b as unknown as Record<string, unknown>;
  for (const k of Object.keys(B)) {
    const x = A[k], y = B[k];
    if (typeof x === 'number' && typeof y === 'number' && k !== 'code' && k !== 'nodes' && k !== 'tillersDrawn') out[k] = x + (y - x) * t;
    else if (k === 'tillersDrawn' && typeof x === 'number' && typeof y === 'number') out[k] = x + (y - x) * t;
    else if (t < 0.5) out[k] = x;
  }
  out.code = b.code;
  return out as unknown as PlantModel;
}

export type Season = 'autumn' | 'winter' | 'spring' | 'earlySummer' | 'summer';
/** Якісне положення фази в сезоні озимих зернових (без календарних дат: вони залежать від зони, сорту й погоди). */
export function seasonOf(code: number): Season[] {
  if (code < 21) return ['autumn'];
  if (code < 30) return ['autumn', 'spring'];
  if (code < 51) return ['spring'];
  if (code < 71) return ['spring', 'earlySummer'];
  return ['summer'];
}
export const SEASON_ORDER: Season[] = ['autumn', 'winter', 'spring', 'earlySummer', 'summer'];

/**
 * Скільки пагонів кущіння малюється (дробове значення — для плавного наростання).
 * Після BBCH 90 шкала вже не лічить пагони (tillers = 0), але самі пагони нікуди не зникають; малюється не більше 5.
 */
export const visibleTillers = (m: PlantModel): number => Math.min(5, m.code >= 30 ? 5 : m.tillersDrawn);
