import { describe, expect, it } from 'vitest';
import { crops } from '../src/data/crops';
import { distinguishable, sectionSignature } from '../src/engine/observable';
import { showsStemSection } from '../src/engine/timeline';
import {
  type Answer, type Level, type Question, type Stats,
  buildQuestion, buildSession, check, isStats, makeRng, mergeStats, principalEligible, recordAnswer, shuffle, summarize, weakCodes, weight,
} from '../src/engine/trainer';

const crop = crops[0];
const codes = crop.stages.map((s) => s.code);
const stage = (c: number) => crop.stages.find((s) => s.code === c)!;
const uniq = (a: number[]) => new Set(a).size === a.length;

describe('генератор випадкових чисел', () => {
  it('детермінований, у [0, 1), різні зерна дають різні послідовності', () => {
    const a = makeRng(7), b = makeRng(7), c = makeRng(8);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(xs).not.toEqual(Array.from({ length: 50 }, () => c()));
  });
  it('shuffle зберігає елементи, не змінює вхід, детермінований', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const s1 = shuffle(src, makeRng(3));
    expect([...s1].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shuffle(src, makeRng(3))).toEqual(s1);
  });
});

describe('питання в режимі SVG: чесність і цілісність', () => {
  const levels: Level[] = ['principal', 'phase', 'compare'];
  it('для кожної фази, рівня й 25 зерен: варіанти унікальні, містять правильний, на малюнку розрізнювані', () => {
    let built = 0;
    for (const level of levels) for (const c of codes) for (let seed = 1; seed <= 25; seed++) {
      const q = buildQuestion(crop, level, c, makeRng(seed), 'svg', 'x');
      if (!q) continue;
      built++;
      const tag = `${level} ${c} #${seed}`;
      expect(uniq(q.options), tag).toBe(true);
      expect(q.options.includes(q.correct), tag).toBe(true);
      expect(q.visual).toBe('svg');
      if (level === 'principal') {
        expect(q.correct, tag).toBe(stage(c).principal);
        expect(q.options).toHaveLength(4);
        expect(q.section).toBe(false);
        expect(principalEligible(crop).includes(c), tag).toBe(true);
      } else {
        expect(q.correct, tag).toBe(c);
        const inRange = level === 'phase' ? showsStemSection(c) : q.options.some(showsStemSection);
        for (let i = 0; i < q.options.length; i++) for (let j = i + 1; j < q.options.length; j++) expect(distinguishable(q.options[i], q.options[j], inRange), `${tag}: ${q.options[i]}/${q.options[j]}`).toBe(true);
        // розріз показується тоді й лише тоді, коли він відрізняє варіанти між собою
        expect(q.section, `${tag}: розріз`).toBe(inRange && new Set(q.options.map(sectionSignature)).size > 1);
      }
      if (level === 'phase') {
        expect(q.options).toHaveLength(4);
        expect(q.options.every((o) => showsStemSection(o) === showsStemSection(c)), `${tag}: усі варіанти з одного боку діапазону 29–49`).toBe(true);
      }
      if (level === 'compare') {
        expect(q.options).toHaveLength(2);
        const partner = q.options.find((o) => o !== c)!;
        expect(stage(c).confusableWith, tag).toContain(partner);
      }
    }
    expect(built).toBeGreaterThan(2500);
  });
  it('на рівні «головна стадія» не беруться фази 49 і 51: на малюнку вони однакові, а стадії різні', () => {
    expect(principalEligible(crop).length).toBe(59);
    expect(principalEligible(crop).includes(49)).toBe(false);
    expect(principalEligible(crop).includes(51)).toBe(false);
    expect(buildQuestion(crop, 'principal', 49, makeRng(1), 'svg', 'x')).toBeNull();
    expect(buildQuestion(crop, 'principal', 49, makeRng(1), 'photo', 'x')).not.toBeNull();
  });
  it('порівняння: рівно 12 фаз із даними про плутанину; для інших питання немає', () => {
    const withData = codes.filter((c) => (stage(c).confusableWith?.length ?? 0) > 0);
    expect(withData).toEqual([30, 31, 37, 39, 45, 51, 55, 61, 75, 85, 87, 89]);
    expect(buildQuestion(crop, 'compare', 13, makeRng(1), 'svg', 'x')).toBeNull();
    for (const c of withData) expect(buildQuestion(crop, 'compare', c, makeRng(1), 'svg', 'x'), String(c)).not.toBeNull();
  });
  it('фаза, якої немає в шкалі (34), питання не дає', () => {
    expect(buildQuestion(crop, 'phase', 34, makeRng(1), 'svg', 'x')).toBeNull();
  });
  it('розріз стебла не показується, коли всі варіанти мають однаковий розріз (37–49: зачаток вже вище кадру), і показується, коли вони різні', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const q = buildQuestion(crop, 'phase', 45, makeRng(seed), 'svg', 'x')!;
      expect(new Set(q.options.map(sectionSignature)).size === 1, `45 #${seed}`).toBe(true);
      expect(q.section, `45 #${seed}`).toBe(false);
    }
    expect(buildQuestion(crop, 'phase', 32, makeRng(1), 'svg', 'x')!.section).toBe(true);
    expect(buildQuestion(crop, 'compare', 31, makeRng(1), 'svg', 'x')!.section).toBe(true);
    expect(buildQuestion(crop, 'compare', 45, makeRng(1), 'svg', 'x')!.section).toBe(false);
  });
  it('наявність розрізу не видає правильну відповідь: серед питань із розрізом правильною є і перша, і остання з варіантів за діапазоном', () => {
    const correctIn = { inRange: 0, outRange: 0 };
    for (let seed = 1; seed <= 300; seed++) for (const c of [29, 30, 31, 32, 33, 37, 39, 45]) {
      const q = buildQuestion(crop, 'phase', c, makeRng(seed), 'svg', 'x')!;
      if (!q.section) continue;
      // при розрізі всі варіанти з одного боку діапазону, тож за наявністю розрізу про правильний варіант нічого не дізнатися
      expect(q.options.every((o) => showsStemSection(o))).toBe(true);
      correctIn.inRange++;
    }
    expect(correctIn.inRange).toBeGreaterThan(100);
  });
  it('позиція правильної відповіді не передбачувана: у 400 питаннях вона трапляється на всіх чотирьох місцях', () => {
    const pos = [0, 0, 0, 0];
    for (let seed = 1; seed <= 400; seed++) { const q = buildQuestion(crop, 'phase', 32, makeRng(seed), 'svg', 'x')!; pos[q.options.indexOf(q.correct)]++; }
    expect(pos.every((n) => n > 50)).toBe(true);
  });
});

describe('сесія', () => {
  it('10 питань, унікальні фази, детермінована за зерном, різні зерна дають різні сесії', () => {
    const s = buildSession(crop, { level: 'phase', seed: 5 });
    expect(s).toHaveLength(10);
    expect(uniq(s.map((q) => q.code))).toBe(true);
    expect(buildSession(crop, { level: 'phase', seed: 5 })).toEqual(s);
    expect(buildSession(crop, { level: 'phase', seed: 6 }).map((q) => q.code)).not.toEqual(s.map((q) => q.code));
  });
  it('length більше за кількість придатних фаз: сесія коротша, без повторів (порівняння — 12)', () => {
    const s = buildSession(crop, { level: 'compare', seed: 1, length: 30 });
    expect(s).toHaveLength(12);
    expect(uniq(s.map((q) => q.code))).toBe(true);
  });
  it('режим фото: лише фази, для яких є фото; фото-питання без розрізу; відмінні на малюнку варіанти не потрібні', () => {
    const s = buildSession(crop, { level: 'phase', seed: 2, photoCodes: [13, 32, 65, 89, 999] });
    expect(s).toHaveLength(4);
    expect(s.map((q) => q.code).sort((a, b) => a - b)).toEqual([13, 32, 65, 89]);
    for (const q of s) { expect(q.visual).toBe('photo'); expect(q.section).toBe(false); expect(q.options.includes(q.code)).toBe(true); expect(uniq(q.options)).toBe(true); }
  });
  it('режим фото без жодного фото дає порожню сесію (інтерфейс тоді переходить на SVG)', () => {
    expect(buildSession(crop, { level: 'phase', seed: 1, photoCodes: [] })).toEqual([]);
  });
  it('onlyCodes обмежує питання (повторення помилок)', () => {
    const s = buildSession(crop, { level: 'phase', seed: 3, onlyCodes: [37, 39, 45] });
    expect(s.map((q) => q.code).sort((a, b) => a - b)).toEqual([37, 39, 45]);
  });
  it('культура без шкали (кукурудза) дає порожню сесію', () => {
    expect(buildSession(crops.find((c) => c.id === 'maize')!, { level: 'phase', seed: 1 })).toEqual([]);
  });
  it('weakFocus: фаза з помилками потрапляє в сесію помітно частіше, ніж без нього', () => {
    let stats: Stats = {};
    for (const c of codes) for (let i = 0; i < 10; i++) stats = recordAnswer(stats, c, c !== 37);
    const hit = (weak: boolean) => { let n = 0; for (let seed = 1; seed <= 400; seed++) if (buildSession(crop, { level: 'phase', seed, length: 3, stats, weakFocus: weak }).some((q) => q.code === 37)) n++; return n; };
    const base = hit(false), focused = hit(true);
    expect(focused).toBeGreaterThan(base * 2);
  });
});

describe('статистика', () => {
  it('recordAnswer не змінює вхід і лічить правильні й усі спроби', () => {
    const s0: Stats = {};
    const s1 = recordAnswer(s0, 37, false), s2 = recordAnswer(s1, 37, true);
    expect(s0).toEqual({});
    expect(s2['37']).toEqual({ n: 2, ok: 1 });
  });
  it('weight: помилкова > невідома > засвоєна; weakCodes — від найгірших, лише з помилками', () => {
    let st: Stats = {};
    for (let i = 0; i < 6; i++) st = recordAnswer(st, 13, true);
    st = recordAnswer(st, 37, false);
    st = recordAnswer(recordAnswer(st, 39, false), 39, true);
    expect(weight(st, 37)).toBeGreaterThan(weight(st, 99));
    expect(weight(st, 99)).toBeGreaterThan(weight(st, 13));
    expect(weakCodes(st)).toEqual([37, 39]);
    expect(weakCodes(st, 1)).toEqual([37]);
  });
  it('isStats приймає коректні дані й відкидає сміття зі сховища', () => {
    expect(isStats({})).toBe(true);
    expect(isStats({ '37': { n: 2, ok: 1 } })).toBe(true);
    for (const bad of [null, [], 'x', { x: { n: 1, ok: 1 } }, { '37': { n: 1, ok: 2 } }, { '37': { n: 1.5, ok: 1 } }, { '37': { n: -1, ok: 0 } }, { '37': 5 }, { '137': { n: 1, ok: 1 } }]) expect(isStats(bad), JSON.stringify(bad)).toBe(false);
  });
  it('mergeStats додає лише відповіді на відомі питання', () => {
    const qs = buildSession(crop, { level: 'phase', seed: 1, length: 2 });
    const ans: Answer[] = [check(qs[0], qs[0].correct), check(qs[1], qs[1].options.find((o) => o !== qs[1].correct)!), { questionId: 'нема', choice: 1, ok: true }];
    const m = mergeStats({}, qs, ans);
    expect(Object.keys(m).sort()).toEqual([String(qs[0].code), String(qs[1].code)].sort());
    expect(m[String(qs[0].code)]).toEqual({ n: 1, ok: 1 });
    expect(m[String(qs[1].code)]).toEqual({ n: 1, ok: 0 });
  });
});

describe('відповіді й підсумок', () => {
  const mk = (id: string, level: Level, code: number, options: number[], correct: number): Question => ({ id, level, visual: 'svg', code, options, correct, section: false });
  const qs = [
    mk('a', 'principal', 13, [1, 2, 3, 4], 1),
    mk('b', 'phase', 37, [37, 39, 33, 31], 37),
    mk('c', 'phase', 39, [39, 37, 41, 45], 39),
    mk('d', 'phase', 13, [13, 14, 12, 11], 13),
  ];
  it('check порівнює вибір із правильним варіантом', () => {
    expect(check(qs[0], 1).ok).toBe(true);
    expect(check(qs[0], 2).ok).toBe(false);
  });
  it('summarize: відсотки, по головних стадіях, помилки, сплутані пари (37↔39 двічі, ненаправлені)', () => {
    const ans = [check(qs[0], 2), check(qs[1], 39), check(qs[2], 37), check(qs[3], 13)];
    const s = summarize(crop, qs, ans);
    expect([s.total, s.correct, s.percent]).toEqual([4, 1, 25]);
    expect(s.byPrincipal).toEqual([{ principal: 1, asked: 2, correct: 1 }, { principal: 3, asked: 2, correct: 0 }]);
    expect(s.mistakes.map((m) => m.question.id)).toEqual(['a', 'b', 'c']);
    expect(s.confusions).toEqual([{ kind: 'code', a: 37, b: 39, count: 2 }, { kind: 'principal', a: 1, b: 2, count: 1 }]);
  });
  it('порожня сесія: нулі без ділення на нуль', () => {
    expect(summarize(crop, [], [])).toEqual({ total: 0, correct: 0, percent: 0, byPrincipal: [], mistakes: [], confusions: [] });
  });
});
