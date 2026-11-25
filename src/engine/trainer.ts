import type { Crop } from '../types';
import { principalStages } from '../data/principalStages';
import { distinguishable, observableKey, sectionSignature } from './observable';
import { showsStemSection } from './timeline';

/** Рівні: головна стадія; точна фаза BBCH (4 варіанти); порівняння пари фаз, які найчастіше плутають. */
export type Level = 'principal' | 'phase' | 'compare';
export type Visual = 'svg' | 'photo';

export interface Question {
  id: string;
  level: Level;
  visual: Visual;
  /** Фаза на малюнку. */
  code: number;
  /** Варіанти: id головних стадій (principal) або коди фаз (phase, compare). */
  options: number[];
  /** Правильний варіант: id головної стадії або код фази. */
  correct: number;
  /** Чи показується в питанні розріз стебла (лише для SVG). */
  section: boolean;
}
export interface Answer { questionId: string; choice: number; ok: boolean }

// ---------- детермінований генератор випадкових чисел (для тестів і повторюваних сесій) ----------
export type Rng = () => number;
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- статистика по фазах (зберігається в localStorage) ----------
export interface CodeStat { n: number; ok: number }
export type Stats = Record<string, CodeStat>;
const isCodeStat = (x: unknown): boolean => {
  if (typeof x !== 'object' || x === null) return false;
  const { n, ok } = x as Record<string, unknown>;
  return typeof n === 'number' && typeof ok === 'number' && Number.isInteger(n) && Number.isInteger(ok) && n >= 0 && ok >= 0 && ok <= n;
};
export const isStats = (v: unknown): boolean => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.entries(v).every(([k, x]) => /^\d{1,2}$/.test(k) && isCodeStat(x));

export function recordAnswer(stats: Stats, code: number, ok: boolean): Stats {
  const cur = stats[String(code)] ?? { n: 0, ok: 0 };
  return { ...stats, [String(code)]: { n: cur.n + 1, ok: cur.ok + (ok ? 1 : 0) } };
}
export function mergeStats(stats: Stats, questions: Question[], answers: Answer[]): Stats {
  return answers.reduce((acc, a) => {
    const q = questions.find((x) => x.id === a.questionId);
    return q ? recordAnswer(acc, q.code, a.ok) : acc;
  }, stats);
}
/** Вага фази при виборі питання: невідомі й помилкові фази трапляються частіше. */
export function weight(stats: Stats, code: number): number {
  const s = stats[String(code)] ?? { n: 0, ok: 0 };
  return 1 + 3 * ((s.n - s.ok + 0.5) / (s.n + 1));
}
/** Фази з помилками, від найгірших до кращих (для підказки «слабкі місця»). */
export function weakCodes(stats: Stats, limit = 5): number[] {
  return Object.entries(stats)
    .filter(([, s]) => s.n > s.ok)
    .sort(([, a], [, b]) => (b.n - b.ok) / b.n - (a.n - a.ok) / a.n || b.n - a.n)
    .slice(0, limit)
    .map(([k]) => Number(k));
}

// ---------- побудова питань ----------
const codesOf = (crop: Crop): number[] => crop.stages.map((s) => s.code);
const principalOf = (crop: Crop, code: number): number => crop.stages.find((s) => s.code === code)?.principal ?? Math.floor(code / 10);

/** Фази, чия головна стадія однозначна з малюнка: жодна фаза іншої головної стадії не виглядає так само. */
export function principalEligible(crop: Crop): number[] {
  return crop.stages
    .filter((s) => !crop.stages.some((o) => o.principal !== s.principal && observableKey(o.code, false) === observableKey(s.code, false)))
    .map((s) => s.code);
}

function pickDistractors(cands: number[], correct: number, count: number, rng: Rng, ok: (c: number, chosen: number[]) => boolean, rank: (c: number) => number): number[] {
  const sorted = cands.filter((c) => c !== correct).map((c) => ({ c, r: rank(c) + rng() * 2 })).sort((a, b) => a.r - b.r);
  const chosen: number[] = [];
  for (const { c } of sorted) {
    if (chosen.length === count) break;
    if (ok(c, chosen)) chosen.push(c);
  }
  return chosen;
}

export const MIN_PHASE_OPTIONS = 3;

export function buildQuestion(crop: Crop, level: Level, code: number, rng: Rng, visual: Visual, id: string): Question | null {
  const stage = crop.stages.find((s) => s.code === code);
  if (!stage) return null;
  const svg = visual === 'svg';

  if (level === 'principal') {
    if (svg && !principalEligible(crop).includes(code)) return null;
    const present = principalStages.filter((p) => crop.stages.some((s) => s.principal === p.id)).map((p) => p.id);
    const d = pickDistractors(present, stage.principal, 3, rng, () => true, (p) => Math.abs(p - stage.principal));
    if (d.length < 2) return null;
    return { id, level, visual, code, options: shuffle([stage.principal, ...d], rng), correct: stage.principal, section: false };
  }

  if (level === 'phase') {
    const flag = svg && showsStemSection(code); // варіанти беремо лише з того ж боку діапазону 29–49
    const d = pickDistractors(
      codesOf(crop), code, 3, rng,
      (c, chosen) => !svg || (showsStemSection(c) === flag && distinguishable(c, code, flag) && chosen.every((o) => distinguishable(c, o, flag))),
      (c) => Math.abs(c - code) + (principalOf(crop, c) === stage.principal ? 0 : 6),
    );
    if (d.length + 1 < MIN_PHASE_OPTIONS) return null;
    // Розріз показуємо лише коли він відрізняє варіанти між собою (і не залежить від того, який варіант правильний).
    const section = flag && new Set([code, ...d].map(sectionSignature)).size > 1;
    return { id, level, visual, code, options: shuffle([code, ...d], rng), correct: code, section };
  }

  // compare: пара «фаза — та, з якою її плутають»
  const partners = (stage.confusableWith ?? []).filter((p) => crop.stages.some((s) => s.code === p));
  const usable = partners.filter((p) => !svg || distinguishable(code, p, showsStemSection(code) || showsStemSection(p)));
  if (usable.length === 0) return null;
  const partner = usable[Math.floor(rng() * usable.length)];
  const section = svg && (showsStemSection(code) || showsStemSection(partner)) && sectionSignature(code) !== sectionSignature(partner);
  return { id, level, visual, code, options: shuffle([code, partner], rng), correct: code, section };
}

export interface SessionOptions {
  level: Level;
  /** Кількість питань (за замовчуванням 10; менше, якщо питань з підходящих фаз не вистачає). */
  length?: number;
  seed: number;
  stats?: Stats;
  /** Частіше брати фази, де були помилки. */
  weakFocus?: boolean;
  /** Режим фото: коди фаз, для яких є фото (питання лише про них). Не задано — режим SVG. */
  photoCodes?: number[];
  /** Обмежити питання цими фазами (повторення помилок). */
  onlyCodes?: number[];
}

export function buildSession(crop: Crop, o: SessionOptions): Question[] {
  const rng = makeRng(o.seed);
  const visual: Visual = o.photoCodes ? 'photo' : 'svg';
  const stats = o.stats ?? {};
  let pool = codesOf(crop);
  if (o.photoCodes) pool = pool.filter((c) => o.photoCodes!.includes(c));
  if (o.onlyCodes) pool = pool.filter((c) => o.onlyCodes!.includes(c));
  if (o.level === 'compare') pool = pool.filter((c) => (crop.stages.find((s) => s.code === c)?.confusableWith?.length ?? 0) > 0);
  const want = o.length ?? 10;
  const out: Question[] = [];
  const tried = new Set<number>();
  while (out.length < want) {
    const avail = pool.filter((c) => !tried.has(c));
    if (avail.length === 0) break;
    const w = avail.map((c) => (o.weakFocus ? weight(stats, c) : 1));
    let r = rng() * w.reduce((a, b) => a + b, 0), idx = 0;
    while (idx < avail.length - 1 && r >= w[idx]) { r -= w[idx]; idx++; }
    const code = avail[idx];
    tried.add(code);
    const q = buildQuestion(crop, o.level, code, rng, visual, `${out.length + 1}-${o.level}-${code}`);
    if (q) out.push(q);
  }
  return out;
}

// ---------- відповіді й підсумок ----------
export function check(q: Question, choice: number): Answer {
  return { questionId: q.id, choice, ok: choice === q.correct };
}

export interface Confusion { kind: 'code' | 'principal'; a: number; b: number; count: number }
export interface Summary {
  total: number; correct: number; percent: number;
  byPrincipal: { principal: number; asked: number; correct: number }[];
  mistakes: { question: Question; choice: number }[];
  confusions: Confusion[];
}
export function summarize(crop: Crop, questions: Question[], answers: Answer[]): Summary {
  const by = new Map<number, { asked: number; correct: number }>();
  const mistakes: Summary['mistakes'] = [];
  const conf = new Map<string, Confusion>();
  for (const a of answers) {
    const q = questions.find((x) => x.id === a.questionId);
    if (!q) continue;
    const p = principalOf(crop, q.code);
    const cur = by.get(p) ?? { asked: 0, correct: 0 };
    by.set(p, { asked: cur.asked + 1, correct: cur.correct + (a.ok ? 1 : 0) });
    if (a.ok) continue;
    mistakes.push({ question: q, choice: a.choice });
    const kind = q.level === 'principal' ? 'principal' : 'code';
    const [lo, hi] = [Math.min(q.correct, a.choice), Math.max(q.correct, a.choice)];
    const key = `${kind}:${lo}:${hi}`;
    const c = conf.get(key) ?? { kind, a: lo, b: hi, count: 0 };
    conf.set(key, { ...c, count: c.count + 1 });
  }
  const answered = answers.filter((a) => questions.some((q) => q.id === a.questionId));
  const correct = answered.filter((a) => a.ok).length;
  return {
    total: answered.length, correct, percent: answered.length ? Math.round((100 * correct) / answered.length) : 0,
    byPrincipal: [...by.entries()].sort(([x], [y]) => x - y).map(([principal, v]) => ({ principal, ...v })),
    mistakes,
    confusions: [...conf.values()].sort((x, y) => y.count - x.count || x.a - y.a || x.b - y.b),
  };
}
