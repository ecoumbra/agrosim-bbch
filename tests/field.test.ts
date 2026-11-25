import { describe, expect, it } from 'vitest';
import { crops } from '../src/data/crops';
import {
  TOOL_GROUPS, bounds, distribution, emptyFieldStats, fieldCodes, fieldStage, grade, isFieldStats, makeField, makeScenario,
  randomSample, reading, recordField, samplingAccuracy, scenarioCentres, shareAtLeast, type Tool,
} from '../src/engine/field';
import { references } from '../src/data/references';
import { makeRng } from '../src/engine/trainer';

const crop = crops[0];
const codes = crop.stages.map((s) => s.code);

describe('правило «щонайменше 50% рослин» (монографія BBCH, загальна частина)', () => {
  it('стадія поля — найвища стадія, якої досягли щонайменше половина рослин', () => {
    expect(fieldStage([10, 10, 10, 12, 12])).toBe(10); // 12 досягли лише 40%
    expect(fieldStage([12, 12, 10, 10])).toBe(12); // рівно 50% — достатньо («щонайменше»)
    expect(fieldStage([12, 10, 10, 10])).toBe(10); // 25%
    expect(fieldStage([13, 12, 12, 11, 10])).toBe(12); // ≥12: 3 з 5 = 60%; ≥13: 20%
    expect(fieldStage([65])).toBe(65);
    expect(fieldStage([30, 65])).toBe(65); // 1 з 2 = 50%
  });
  it('не залежить від порядку рослин і не змінює вхідний масив', () => {
    const a = [32, 12, 30, 31, 31, 13, 37];
    const copy = [...a];
    expect(fieldStage(a)).toBe(fieldStage([...a].reverse()));
    expect(a).toEqual(copy);
  });
  it('монотонна: підвищення стадії будь-якої рослини не знижує стадію поля', () => {
    const rng = makeRng(11);
    for (let t = 0; t < 300; t++) {
      const n = 1 + Math.floor(rng() * 20);
      const plants = Array.from({ length: n }, () => codes[Math.floor(rng() * codes.length)]);
      const before = fieldStage(plants);
      const i = Math.floor(rng() * n);
      const up = [...plants]; up[i] = Math.max(up[i], codes[Math.min(codes.length - 1, codes.indexOf(up[i]) + 1 + Math.floor(rng() * 3))]);
      expect(fieldStage(up), JSON.stringify(plants)).toBeGreaterThanOrEqual(before);
    }
  });
  it('щонайменше 50% рослин досягли стадії поля, а наступної стадії (якщо є) — менше 50%', () => {
    const rng = makeRng(5);
    for (let t = 0; t < 200; t++) {
      const n = 1 + Math.floor(rng() * 30);
      const plants = Array.from({ length: n }, () => codes[Math.floor(rng() * codes.length)]);
      const f = fieldStage(plants);
      expect(shareAtLeast(plants, f), JSON.stringify(plants)).toBeGreaterThanOrEqual(0.5);
      const higher = plants.filter((c) => c > f);
      if (higher.length) expect(shareAtLeast(plants, Math.min(...higher))).toBeLessThan(0.5);
    }
  });
  it('порожній набір — помилка; shareAtLeast порожнього — 0; distribution лічить і впорядковує', () => {
    expect(() => fieldStage([])).toThrow();
    expect(shareAtLeast([], 10)).toBe(0);
    expect(distribution([12, 10, 12, 11, 12])).toEqual([{ code: 10, count: 1 }, { code: 11, count: 1 }, { code: 12, count: 3 }]);
  });
});

describe('віртуальне поле', () => {
  it('детерміноване за зерном; 100 рослин; усі коди зі шкали в діапазоні 09–97 (немає 99 і насіння в ґрунті)', () => {
    const a = makeField(crop, { seed: 3, centre: 32 }), b = makeField(crop, { seed: 3, centre: 32 });
    expect(a).toEqual(b);
    expect(a.plants).toHaveLength(100);
    expect(makeField(crop, { seed: 4, centre: 32 }).plants).not.toEqual(a.plants);
    for (let seed = 1; seed <= 40; seed++) for (const c of makeScenario(crop, seed).plants) { expect(codes.includes(c)).toBe(true); expect(c >= 9 && c <= 97).toBe(true); }
    expect(fieldCodes(crop).includes(99)).toBe(false);
    expect(fieldCodes(crop).includes(7)).toBe(false);
  });
  it('рослини групуються навколо центру: середній індекс близький до індексу центру; більший spread дає ширший розподіл', () => {
    const pool = fieldCodes(crop);
    const mean = (f: number[]) => f.reduce((s, c) => s + pool.indexOf(c), 0) / f.length;
    const tight = makeField(crop, { seed: 1, centre: 45, spread: 0.5, size: 400 }), wide = makeField(crop, { seed: 1, centre: 45, spread: 3, size: 400 });
    expect(Math.abs(mean(tight.plants) - pool.indexOf(45))).toBeLessThan(0.3);
    expect(distribution(wide.plants).length).toBeGreaterThan(distribution(tight.plants).length);
    expect(makeField(crop, { seed: 2, centre: 45, spread: 0, size: 30 }).plants.every((c) => c === 45)).toBe(true);
  });
  it('сценарії: центр із діапазону 09–92, різні зерна дають різні сценарії, повторювані', () => {
    const centres = scenarioCentres(crop);
    expect(centres[0]).toBe(9);
    expect(centres[centres.length - 1]).toBe(92);
    const seen = new Set<number>();
    for (let s = 1; s <= 80; s++) { const f = makeScenario(crop, s); expect(centres.includes(f.centre)).toBe(true); seen.add(f.centre); }
    expect(seen.size).toBeGreaterThan(15);
    expect(makeScenario(crop, 9)).toEqual(makeScenario(crop, 9));
  });
  it('культура без шкали (кукурудза) — зрозуміла помилка', () => {
    expect(() => makeField(crops.find((c) => c.id === 'maize')!, { seed: 1, centre: 32 })).toThrow(/немає шкали/);
  });
});

describe('вибірка', () => {
  const field = makeField(crop, { seed: 8, centre: 55 });
  it('k різних індексів за зростанням; детермінована; k більше за поле — усе поле; k = 0 — порожньо', () => {
    const s = randomSample(field, 10, makeRng(1));
    expect(s).toHaveLength(10);
    expect(new Set(s).size).toBe(10);
    expect([...s].sort((a, b) => a - b)).toEqual(s);
    expect(s.every((i) => i >= 0 && i < 100)).toBe(true);
    expect(randomSample(field, 10, makeRng(1))).toEqual(s);
    expect(randomSample(field, 10, makeRng(2))).not.toEqual(s);
    expect(randomSample(field, 500, makeRng(1))).toHaveLength(100);
    expect(randomSample(field, 0, makeRng(1))).toEqual([]);
  });
  it('вибірка не зміщена: у 2000 вибірках кожна рослина трапляється приблизно однаково часто', () => {
    const hits = new Array(100).fill(0);
    for (let t = 0; t < 2000; t++) for (const i of randomSample(field, 10, makeRng(t + 100))) hits[i]++;
    expect(Math.min(...hits)).toBeGreaterThan(120); // очікувано 200
    expect(Math.max(...hits)).toBeLessThan(290);
  });
});

describe('інструменти (за текстом шкали зернових)', () => {
  it('групи: 30–33 потребують розтину, 85/87/89/92 — перевірки нігтем; усі коди є у шкалі', () => {
    expect(TOOL_GROUPS).toEqual([{ tool: 'cut', codes: [30, 31, 32, 33] }, { tool: 'nail', codes: [85, 87, 89, 92] }]);
    for (const g of TOOL_GROUPS) for (const c of g.codes) expect(codes.includes(c), String(c)).toBe(true);
  });
  it('без потрібного інструмента рослина з групи читається лише як діапазон; з ним — однозначно', () => {
    expect(reading(crop, 31, ['eye'])).toEqual({ candidates: [30, 31, 32, 33], resolved: false, needs: 'cut' });
    expect(reading(crop, 31, ['eye', 'cut'])).toEqual({ candidates: [31], resolved: true });
    expect(reading(crop, 87, ['eye'])).toEqual({ candidates: [85, 87, 89, 92], resolved: false, needs: 'nail' });
    expect(reading(crop, 87, ['eye', 'nail'])).toEqual({ candidates: [87], resolved: true });
  });
  it('невідповідний інструмент не допомагає: розтин не читає зерно, перевірка нігтем — стебло', () => {
    expect(reading(crop, 87, ['eye', 'cut']).resolved).toBe(false);
    expect(reading(crop, 32, ['eye', 'nail']).resolved).toBe(false);
  });
  it('стадії поза групами читаються однозначно навіть без інструментів', () => {
    for (const c of codes.filter((x) => !TOOL_GROUPS.some((g) => g.codes.includes(x)))) {
      const r = reading(crop, c, ['eye'] as Tool[]);
      expect(r, String(c)).toEqual({ candidates: [c], resolved: true });
    }
  });
});

describe('межі стадії поля за невизначеними показаннями', () => {
  const field = makeField(crop, { seed: 21, centre: 32, spread: 1.5 });
  it('якщо всі рослини прочитано однозначно, межі збігаються зі стадією поля', () => {
    const rs = field.plants.map((c) => reading(crop, c, ['eye', 'cut', 'nail']));
    const b = bounds(rs);
    expect(b.low).toBe(b.high);
    expect(b.low).toBe(fieldStage(field.plants));
  });
  it('справжня стадія вибірки завжди лежить між межами, а межі розходяться, лише коли є невизначені рослини', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const f = makeScenario(crop, seed);
      const idx = randomSample(f, 15, makeRng(seed));
      const truthSample = fieldStage(idx.map((i) => f.plants[i]));
      for (const used of [['eye'], ['eye', 'cut'], ['eye', 'nail'], ['eye', 'cut', 'nail']] as Tool[][]) {
        const rs = idx.map((i) => reading(crop, f.plants[i], used));
        const b = bounds(rs);
        expect(b.low, `${seed} ${used}`).toBeLessThanOrEqual(truthSample);
        expect(b.high, `${seed} ${used}`).toBeGreaterThanOrEqual(truthSample);
        if (rs.every((r) => r.resolved)) expect(b.low).toBe(b.high);
      }
    }
  });
  it('поле навколо 32 без розтину дає інтервал, після розтину — одне значення', () => {
    const idx = randomSample(field, 20, makeRng(4));
    const blind = bounds(idx.map((i) => reading(crop, field.plants[i], ['eye'])));
    const cut = bounds(idx.map((i) => reading(crop, field.plants[i], ['eye', 'cut'])));
    expect(blind.low).toBeLessThan(blind.high);
    expect(cut.low).toBe(cut.high);
  });
});

describe('оцінювання відповіді', () => {
  it('точно / сусідня стадія шкали / далеко (відстань у кроках шкали, а не в кодах)', () => {
    expect(grade(crop, 32, 32)).toEqual({ outcome: 'exact', steps: 0 });
    expect(grade(crop, 33, 37)).toEqual({ outcome: 'adjacent', steps: 1 }); // 34–36 у зернових немає
    expect(grade(crop, 19, 21)).toEqual({ outcome: 'adjacent', steps: 1 }); // 20 немає
    expect(grade(crop, 30, 33)).toEqual({ outcome: 'off', steps: 3 });
    expect(grade(crop, 10, 99).outcome).toBe('off');
  });
});

describe('точність вибірки', () => {
  it('перепис усього поля завжди дає стадію поля; результат повторюваний', () => {
    for (let seed = 1; seed <= 20; seed++) expect(samplingAccuracy(makeScenario(crop, seed), 100, 20, seed)).toBe(1);
    const f = makeScenario(crop, 3);
    expect(samplingAccuracy(f, 10, 50, 1)).toBe(samplingAccuracy(f, 10, 50, 1));
    expect(samplingAccuracy(f, 10, 0, 1)).toBe(0);
  });
  it('більша вибірка в середньому точніша: 5 < 20 < 50 рослин (у середньому за 40 полів)', () => {
    const avg = (k: number) => { let s = 0; for (let seed = 1; seed <= 40; seed++) s += samplingAccuracy(makeScenario(crop, seed), k, 100, seed * 13); return s / 40; };
    const a5 = avg(5), a20 = avg(20), a50 = avg(50);
    expect(a5).toBeLessThan(a20);
    expect(a20).toBeLessThan(a50);
    expect(a50).toBeGreaterThan(0.75);
    expect(a5).toBeLessThan(0.6);
  });
});

describe('статистика', () => {
  it('recordField лічить результати й розмір вибірки, не змінює вхід', () => {
    const s0 = emptyFieldStats();
    const s1 = recordField(s0, 'exact', 10), s2 = recordField(s1, 'off', 10), s3 = recordField(s2, 'adjacent', 20);
    expect(s0).toEqual(emptyFieldStats());
    expect(s3).toEqual({ runs: 3, exact: 1, adjacent: 1, off: 1, bySize: { '10': { n: 2, exact: 1 }, '20': { n: 1, exact: 0 } } });
    expect(isFieldStats(s3)).toBe(true);
  });
  it('isFieldStats відкидає сміття зі сховища', () => {
    expect(isFieldStats(emptyFieldStats())).toBe(true);
    for (const bad of [null, [], 'x', {}, { runs: 1, exact: 1, adjacent: 1, off: 0, bySize: {} }, { runs: -1, exact: 0, adjacent: 0, off: 0, bySize: {} },
      { runs: 1, exact: 1, adjacent: 0, off: 0, bySize: { x: { n: 1, exact: 1 } } }, { runs: 1, exact: 1, adjacent: 0, off: 0, bySize: { '10': { n: 1, exact: 2 } } },
      { runs: 1.5, exact: 1, adjacent: 0, off: 0, bySize: {} }, { runs: 1, exact: 1, adjacent: 0, off: 0, bySize: [] }]) expect(isFieldStats(bad), JSON.stringify(bad)).toBe(false);
  });
});

describe('джерело правила 50%', () => {
  it('у references.ts є запис про 2-ге видання монографії зі статусом secondary (старіше видання, сторонній хостинг) і посиланням', () => {
    const r = references.find((x) => x.id === 'ref-bbch-2001');
    expect(r).toBeDefined();
    expect(r!.status).toBe('secondary');
    expect(r!.citation).toContain('50%');
    expect(r!.citation).toContain('2001');
    expect(r!.citation).toContain('у виданні 2018 не звірено');
    expect(r!.url).toMatch(/^https:\/\//);
    expect(references.filter((x) => x.status === 'primary')).toHaveLength(1); // первинне джерело одне: видання 2018
  });
});
