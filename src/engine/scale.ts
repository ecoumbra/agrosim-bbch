import type { Crop, Stage } from '../types';
import { principalStages } from '../data/principalStages';

export const displayCode = (n: number): string => String(n).padStart(2, '0');
export const stageByCode = (c: Crop, code: number): Stage | undefined => c.stages.find((s) => s.code === code);
export const stagesOfPrincipal = (c: Crop, p: number): Stage[] => c.stages.filter((s) => s.principal === p);

/** Найближча наявна стадія до коду (за рівної відстані — менша). */
export function nearestStage(c: Crop, code: number): Stage | undefined {
  return [...c.stages].sort((a, b) => Math.abs(a.code - code) - Math.abs(b.code - code) || a.code - b.code)[0];
}

/** Перевірка цілісності шкали культури; повертає список проблем (порожній — все гаразд). */
export function validateCrop(c: Crop, refIds: string[]): string[] {
  const issues: string[] = [];
  let prev = -1;
  const codes = new Set(c.stages.map((s) => s.code));
  for (const s of c.stages) {
    if (s.code <= prev) issues.push(`${c.id}: код ${s.code} не зростає або дублюється`);
    prev = s.code;
    if (s.code < 0 || s.code > 99) issues.push(`${c.id}: код ${s.code} поза 00–99`);
    if (s.principal !== Math.floor(s.code / 10)) issues.push(`${c.id}: ${s.code} має неправильну головну стадію ${s.principal}`);
    for (const lang of ['uk', 'en'] as const) {
      if (!s.name[lang].trim() || !s.description[lang].trim()) issues.push(`${c.id}: ${s.code} без тексту (${lang})`);
    }
    for (const x of s.confusableWith ?? []) if (!codes.has(x) || x === s.code) issues.push(`${c.id}: ${s.code} посилається на невалідну фазу ${x}`);
    for (const r of s.refs) if (!refIds.includes(r)) issues.push(`${c.id}: ${s.code} посилається на невідоме джерело ${r}`);
  }
  for (const p of principalStages) if (c.stages.length && !c.stages.some((s) => s.principal === p.id)) issues.push(`${c.id}: немає жодної стадії головної стадії ${p.id}`);
  return issues;
}

/** Пошук за кодом або фрагментом назви. */
export function searchStages(c: Crop, query: string, lang: 'uk' | 'en'): Stage[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (/^\d{1,2}$/.test(q)) { const n = Number(q); const s = stageByCode(c, n); return s ? [s] : []; }
  return c.stages.filter((s) => s.name[lang].toLowerCase().includes(q) || s.description[lang].toLowerCase().includes(q));
}
