import type { Crop } from '../types';
import { type Rng, makeRng, shuffle } from './trainer';

/**
 * Польова діагностика: віртуальне поле, вибірка рослин і оцінка фази поля.
 *
 * З монографії BBCH (2-ге видання, 2001, загальна частина): стадія посіву/насадження описується правилом
 * «опис має виконуватись щонайменше для 50% рослин»; береться до уваги лише головне стебло.
 * Це єдиний поріг для фази поля, який є в джерелі. Порогів «початок/повна фаза», розміру вибірки і розкиду фаз у полі
 * у джерелі немає: вони тут навчальні, авторські (розкид — `spread`, розмір вибірки обирає студент).
 */

/** Огляд — те, що видно без втручання; розтин стебла з лінійкою; перевірка нігтем. */
export type Tool = 'eye' | 'cut' | 'nail';

/**
 * Стадії, які за текстом шкали зернових неможливо прочитати без інструмента:
 * 30–33 — сантиметри над вузлом кущіння і положення верхівки зачатка колоса (розтин + лінійка);
 * 85, 87, 89, 92 — відбиток нігтя / поділ нігтем (перевірка нігтем). Решта стадій читається однозначно.
 */
export const TOOL_GROUPS: { tool: Exclude<Tool, 'eye'>; codes: number[] }[] = [
  { tool: 'cut', codes: [30, 31, 32, 33] },
  { tool: 'nail', codes: [85, 87, 89, 92] },
];

const codesOf = (crop: Crop): number[] => crop.stages.map((s) => s.code);
const indexOf = (crop: Crop, code: number): number => codesOf(crop).indexOf(code);
/** Стадії, у яких рослина є в полі: від сходів (09) до відмерлої рослини (97); 99 — це вже зібраний урожай. */
export const fieldCodes = (crop: Crop): number[] => codesOf(crop).filter((c) => c >= 9 && c <= 97);

// ---------------------------------------------------------------- правило 50 %
/** Стадія поля: найвища стадія, якої досягли щонайменше 50% рослин (за числовим порядком кодів). */
export function fieldStage(codes: number[]): number {
  if (codes.length === 0) throw new Error('fieldStage: порожній набір рослин');
  const desc = [...codes].sort((a, b) => b - a);
  return desc[Math.ceil(desc.length / 2) - 1];
}
/** Частка рослин, що досягли стадії code або пізнішої. */
export const shareAtLeast = (codes: number[], code: number): number => (codes.length ? codes.filter((c) => c >= code).length / codes.length : 0);
/** Розподіл рослин за стадіями (лише наявні стадії, за зростанням коду). */
export function distribution(codes: number[]): { code: number; count: number }[] {
  const m = new Map<number, number>();
  for (const c of codes) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m.entries()].sort(([a], [b]) => a - b).map(([code, count]) => ({ code, count }));
}

// ---------------------------------------------------------------- віртуальне поле
export interface Field {
  seed: number;
  /** Стадія, навколо якої розподілені рослини (не обов'язково дорівнює стадії поля). */
  centre: number;
  /** Розкид стадій у кроках шкали (навчальний параметр). */
  spread: number;
  /** Стадія головного стебла кожної рослини (код зі шкали). */
  plants: number[];
}

function gauss(rng: Rng): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function makeField(crop: Crop, o: { seed: number; centre: number; spread?: number; size?: number }): Field {
  const codes = fieldCodes(crop);
  if (codes.length === 0) throw new Error('makeField: у культури немає шкали');
  const rng = makeRng(o.seed);
  const spread = o.spread ?? 1.8, size = o.size ?? 100;
  const ci = Math.max(0, codes.indexOf(o.centre));
  const plants = Array.from({ length: size }, () => codes[Math.min(codes.length - 1, Math.max(0, Math.round(ci + spread * gauss(rng))))]);
  return { seed: o.seed, centre: codes[ci], spread, plants };
}

/** Стадії, навколо яких має сенс будувати поле: від сходів до перестигання. */
export const scenarioCentres = (crop: Crop): number[] => fieldCodes(crop).filter((c) => c <= 92);

/** Випадковий сценарій (центр і розкид) за зерном; повторюваний. */
export function makeScenario(crop: Crop, seed: number): Field {
  const rng = makeRng((seed ^ 0xa5a5a5a5) >>> 0);
  const centres = scenarioCentres(crop);
  return makeField(crop, { seed, centre: centres[Math.floor(rng() * centres.length)], spread: 1.2 + rng() * 1.2 });
}

/** Індекси k різних рослин (випадкова вибірка), за зростанням. */
export function randomSample(field: Field, k: number, rng: Rng): number[] {
  const idx = shuffle(field.plants.map((_, i) => i), rng).slice(0, Math.max(0, Math.min(k, field.plants.length)));
  return idx.sort((a, b) => a - b);
}

// ---------------------------------------------------------------- спостереження за рослиною
export interface Reading {
  /** Стадії, між якими поки не можна обрати (одна — якщо рослину прочитано однозначно). */
  candidates: number[];
  resolved: boolean;
  /** Інструмент, який потрібен, щоб прочитати рослину однозначно. */
  needs?: Exclude<Tool, 'eye'>;
}

/** Що можна сказати про рослину зі стадією `code`, якщо використано інструменти `used`. */
export function reading(crop: Crop, code: number, used: Tool[]): Reading {
  const group = TOOL_GROUPS.find((g) => g.codes.includes(code));
  if (!group || used.includes(group.tool)) return { candidates: [code], resolved: true };
  const present = group.codes.filter((c) => codesOf(crop).includes(c));
  return { candidates: present, resolved: present.length <= 1, needs: group.tool };
}

/** Межі стадії поля за показаннями: найнижча (усі невизначені на нижній межі) і найвища (на верхній). */
export function bounds(readings: Reading[]): { low: number; high: number } {
  return { low: fieldStage(readings.map((r) => Math.min(...r.candidates))), high: fieldStage(readings.map((r) => Math.max(...r.candidates))) };
}

// ---------------------------------------------------------------- оцінювання
export type Outcome = 'exact' | 'adjacent' | 'off';
export function grade(crop: Crop, answer: number, truth: number): { outcome: Outcome; steps: number } {
  const steps = Math.abs(indexOf(crop, answer) - indexOf(crop, truth));
  return { outcome: steps === 0 ? 'exact' : steps === 1 ? 'adjacent' : 'off', steps };
}

/** Яка частка випадкових вибірок розміру k (з однозначно прочитаними рослинами) дає ту саму стадію поля, що й усе поле. */
export function samplingAccuracy(field: Field, k: number, trials: number, seed: number): number {
  const truth = fieldStage(field.plants);
  let hit = 0;
  for (let t = 0; t < trials; t++) {
    const idx = randomSample(field, k, makeRng((seed + t * 7919) >>> 0));
    if (fieldStage(idx.map((i) => field.plants[i])) === truth) hit++;
  }
  return trials > 0 ? hit / trials : 0;
}

// ---------------------------------------------------------------- статистика (зберігається в браузері)
export interface FieldStats { runs: number; exact: number; adjacent: number; off: number; bySize: Record<string, { n: number; exact: number }> }
export const emptyFieldStats = (): FieldStats => ({ runs: 0, exact: 0, adjacent: 0, off: 0, bySize: {} });
const nat = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;
export function isFieldStats(v: unknown): boolean {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  if (!nat(s.runs) || !nat(s.exact) || !nat(s.adjacent) || !nat(s.off) || s.exact + s.adjacent + s.off !== s.runs) return false;
  if (typeof s.bySize !== 'object' || s.bySize === null || Array.isArray(s.bySize)) return false;
  return Object.entries(s.bySize).every(([k, x]) => /^\d{1,3}$/.test(k) && typeof x === 'object' && x !== null && nat((x as { n?: unknown }).n) && nat((x as { ok?: unknown; exact?: unknown }).exact) && (x as { exact: number }).exact <= (x as { n: number }).n);
}
export function recordField(stats: FieldStats, outcome: Outcome, sampleSize: number): FieldStats {
  const cur = stats.bySize[String(sampleSize)] ?? { n: 0, exact: 0 };
  return {
    runs: stats.runs + 1, exact: stats.exact + (outcome === 'exact' ? 1 : 0), adjacent: stats.adjacent + (outcome === 'adjacent' ? 1 : 0), off: stats.off + (outcome === 'off' ? 1 : 0),
    bySize: { ...stats.bySize, [String(sampleSize)]: { n: cur.n + 1, exact: cur.exact + (outcome === 'exact' ? 1 : 0) } },
  };
}
