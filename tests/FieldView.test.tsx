import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { crops } from '../src/data/crops';
import { getDict } from '../src/i18n';
import { FieldResult, FieldSetup, FieldView, FieldWork, SAMPLE_SIZES, recorded, type Round } from '../src/components/FieldView';
import { type Field, type Tool, emptyFieldStats, makeField, randomSample, recordField } from '../src/engine/field';
import { makeRng } from '../src/engine/trainer';

const crop = crops[0];
const noop = () => {};
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const stage = (c: number) => crop.stages.find((s) => s.code === c)!;

const round = (plants: number[], sample: number[] | null, over: Partial<Round> = {}): Round =>
  ({ field: { seed: 1, centre: 32, spread: 1, plants }, k: sample?.length ?? 10, draw: sample ? 1 : 0, sample, used: {}, guess: {}, answer: null, ...over });
const work = (r: Round, lang: 'uk' | 'en' = 'uk') =>
  renderToStaticMarkup(<FieldWork round={r} crop={crop} lang={lang} t={getDict(lang)} onDraw={noop} onTool={noop} onToolAll={noop} onGuess={noop} onAnswer={noop} />);
const result = (r: Round, atlas = false, lang: 'uk' | 'en' = 'uk') =>
  renderToStaticMarkup(<FieldResult round={r} crop={crop} lang={lang} t={getDict(lang)} onAgain={noop} onSetup={noop} onOpenAtlas={atlas ? noop : undefined} />);
const plants100 = (fn: (i: number) => number) => Array.from({ length: 100 }, (_, i) => fn(i));

describe('налаштування', () => {
  const setup = (k = 10, stats = emptyFieldStats(), lang: 'uk' | 'en' = 'uk') => renderToStaticMarkup(<FieldSetup t={getDict(lang)} k={k} onK={noop} stats={stats} onStart={noop} onResetStats={noop} />);
  it('4 розміри вибірки, обраний позначено; джерело правила 50% і застереження про авторське', () => {
    const out = setup(20);
    expect(SAMPLE_SIZES).toEqual([5, 10, 20, 50]);
    expect(count(out, /name="k"/g)).toBe(4);
    expect(out).toMatch(/name="k" checked="" value="20"/);
    expect(out).toContain('щонайменше 50% рослин');
    expect(out).toContain('2-ге видання 2001');
    expect(out).toContain('у шкалі BBCH не сказано');
    expect(out).toContain('Статистики ще немає');
    expect(out).not.toContain('Скинути статистику');
  });
  it('статистика: підсумок, розподіл за розміром вибірки, кнопка скидання', () => {
    let st = emptyFieldStats();
    st = recordField(recordField(recordField(st, 'exact', 10), 'off', 10), 'adjacent', 50);
    const out = setup(10, st);
    expect(out).toContain('(полів: 3): точно 1, сусідня стадія 1, далеко 1');
    expect(out).toContain('10 — 1/2; 50 — 0/1');
    expect(out).toContain('Скинути статистику');
  });
  it('англійська без NaN/undefined', () => { expect(setup(10, emptyFieldStats(), 'en')).not.toMatch(/NaN|undefined/); });
});

describe('recorded: запис студента про рослину', () => {
  const r = round([31, 12, 87], [0, 1, 2]);
  it('однозначне показання записується саме; діапазонне — лише після вибору серед кандидатів', () => {
    expect(recorded(crop, r, 1)).toBe(12);
    expect(recorded(crop, r, 0)).toBeNull();
    expect(recorded(crop, { ...r, guess: { 0: 32 } }, 0)).toBe(32);
    expect(recorded(crop, { ...r, guess: { 0: 12 } }, 0)).toBeNull(); // 12 не серед кандидатів 30–33
    expect(recorded(crop, { ...r, used: { 0: ['cut'] } }, 0)).toBe(31);
    expect(recorded(crop, { ...r, used: { 2: ['cut'] } }, 2)).toBeNull(); // розтин не читає зерно
    expect(recorded(crop, { ...r, used: { 2: ['nail'] } }, 2)).toBe(87);
    expect(recorded(crop, { ...r, guess: { 1: 99 } }, 1)).toBe(12);
  });
});

describe('екран відбору й огляду', () => {
  const field: Field = makeField(crop, { seed: 5, centre: 32, spread: 1.5 });
  const sample = randomSample(field, 10, makeRng(3));
  it('до відбору: карта з 100 клітинок без жодної рослини, кнопка відбору, немає списку й відповіді', () => {
    const out = work(round(field.plants, null));
    expect(count(out, /class="fd-cell"/g)).toBe(100);
    expect(count(out, /data-sampled="true"/g)).toBe(0);
    expect(out).toContain('Відібрати 10 випадкових рослин');
    expect(out).not.toContain('fd-list');
    expect(out).not.toContain('Яка фаза поля?');
    expect(out).toContain('Стадії рослин приховані');
  });
  it('після відбору: k позначених клітинок і рядків, кнопка «Відібрати інші» активна, поки не було огляду', () => {
    const out = work(round(field.plants, sample));
    expect(count(out, /data-sampled="true"/g)).toBe(10);
    expect(count(out, /class="fd-row"/g)).toBe(10);
    expect(out).toMatch(/<button[^>]*class="primary"[^>]*>Відібрати інші/);
    expect(out).not.toMatch(/class="primary" disabled=""[^>]*>Відібрати інші/);
  });
  it('після огляду (інструмент або запис) відбір змінити не можна', () => {
    const out = work(round(field.plants, sample, { used: { [sample[0]]: ['cut' as Tool] } }));
    expect(out).toMatch(/disabled=""[^>]*>Відібрати інші/);
    expect(out).toContain('Відбір змінити не можна');
  });
  it('невизначені рослини: діапазон і потрібний інструмент, вибір запису; відповідь заблоковано, поки є незаписані', () => {
    const plants = plantsWith([31, 12, 87]);
    const out = work(round(plants, [0, 1, 2]));
    expect(out).toContain('BBCH 30–33: потрібен розтин стебла з лінійкою');
    expect(out).toContain('BBCH 85–92: потрібен перевірка нігтем');
    expect(count(out, /class="fd-guess"/g)).toBe(2);
    expect(out).toContain('Рослин без записаної стадії: 2.');
    expect(out).toMatch(/<select[^>]*aria-label="Яка фаза поля\?"[^>]*disabled=""/);
    expect(out).toMatch(/<button class="primary" disabled=""[^>]*>Дати відповідь/);
    expect(out).toContain('може бути від 30 до 33'); // правило 50% за нижніми [30, 12, 85] дає 30, за верхніми [33, 12, 92] — 33
  });
  it('після потрібних інструментів усе записано: відповідь доступна, таблиця з часткою «досягли ≥»', () => {
    const plants = plantsWith([31, 12, 87, 12]);
    const out = work(round(plants, [0, 1, 2, 3], { used: { 0: ['cut'], 2: ['nail'] } }));
    expect(out).not.toContain('без записаної стадії');
    expect(out).not.toMatch(/<select[^>]*aria-label="Яка фаза поля\?"[^>]*disabled/);
    expect(out).toMatch(/<button class="primary" disabled=""[^>]*>Дати відповідь/); // стадію ще не обрано
    expect(out).toMatch(/<td>12 · [^<]*<\/td><td>2<\/td><td>100%<\/td>/);
    expect(out).toMatch(/<td>87 · [^<]*<\/td><td>1<\/td><td>25%<\/td>/);
  });
  it('частка «досягли ≥» рахується від записаних рослин, а не від усіх відібраних', () => {
    const out = work(round(plantsWith([31, 12, 12, 12]), [0, 1, 2, 3])); // рослина 0 ще без запису
    expect(out).toContain('Рослин без записаної стадії: 1.');
    expect(out).toMatch(/<td>12 · [^<]*<\/td><td>3<\/td><td>100%<\/td>/);
  });
  it('НЕ ВИДАЄ відповіді: поля, що різняться лише справжньою стадією всередині невизначеної групи, відображаються однаково', () => {
    for (const [a, b] of [[31, 33], [30, 32], [85, 92], [87, 89]]) {
      const x = work(round(plantsWith([a, 12]), [0, 1])), y = work(round(plantsWith([b, 12]), [0, 1]));
      expect(x, `${a} vs ${b}`).toBe(y);
    }
  });
  it('після застосування потрібного інструмента показання різняться (інструмент справді дає інформацію)', () => {
    const x = work(round(plantsWith([31, 12]), [0, 1], { used: { 0: ['cut'] } })), y = work(round(plantsWith([33, 12]), [0, 1], { used: { 0: ['cut'] } }));
    expect(x).not.toBe(y);
    expect(x).toContain(stage(31).name.uk);
  });
  it('англійською без NaN/undefined', () => { expect(work(round(plantsWith([31, 12, 87]), [0, 1, 2]), 'en')).not.toMatch(/NaN|undefined/); });
});

describe('екран результату', () => {
  // 55 рослин у стадії 32 і 45 у стадії 30: стадія поля — 32 (55% досягли 32)
  const plants = plants100((i) => (i < 55 ? 32 : 30));
  const low = Array.from({ length: 5 }, (_, i) => 99 - i); // п'ять рослин зі стадії 30
  const base = round(plants, low, { used: Object.fromEntries(low.map((i) => [i, ['cut' as Tool]])), k: 5 });
  it('вибірка дала іншу стадію, ніж поле: «Далеко», похибка вибірки, точність за розмірами, обидва розподіли', () => {
    const out = result({ ...base, answer: 30 });
    expect(out).toContain('Результат: Далеко від стадії поля.');
    expect(out).toContain('Вибірка з 5 рослин дала 30, а все поле — 32: це похибка вибірки.');
    expect(count(out, /<li data-current=/g)).toBe(4);
    expect(out).toMatch(/<li data-current="true"><b>5<\/b>/);
    expect(count(out, /class="plain fd-bars"/g)).toBe(2);
    expect(out).toContain('це властивість віртуального поля, а не норма');
    expect(out).not.toContain('Ваші записи за правилом 50%');
  });
  it('відповідь, що суперечить правилу за власними записами, пояснюється', () => {
    const out = result({ ...base, answer: 33 });
    expect(out).toContain('Ваші записи за правилом 50% дають 30, а ви відповіли 33');
  });
  it('усе збіглось: «Точно!» і «ту саму стадію»', () => {
    const good = Array.from({ length: 5 }, (_, i) => i); // п'ять рослин зі стадії 32
    const r = round(plants, good, { used: Object.fromEntries(good.map((i) => [i, ['cut' as Tool]])), k: 5, answer: 32 });
    const out = result(r);
    expect(out).toContain('Результат: Точно!');
    expect(out).toContain('ту саму стадію, що й усе поле');
    expect(out).not.toContain('похибка вибірки');
  });
  it('сусідня стадія шкали; кнопка Атласу лише коли передано обробник', () => {
    const near = round(plants100((i) => (i < 55 ? 33 : 31)), [0, 1, 2], { used: { 0: ['cut'], 1: ['cut'], 2: ['cut'] }, k: 5, answer: 32 });
    expect(result(near)).toContain('Сусідня стадія шкали.');
    expect(result(near)).not.toContain('Відкрити в Атласі');
    expect(result(near, true)).toContain('Відкрити в Атласі');
  });
  it('англійською без NaN/undefined', () => { expect(result({ ...base, answer: 30 }, true, 'en')).not.toMatch(/NaN|undefined/); });
});

describe('FieldView', () => {
  it('починає з налаштувань', () => {
    for (const lang of ['uk', 'en'] as const) {
      const out = renderToStaticMarkup(<FieldView lang={lang} t={getDict(lang)} />);
      expect(out).toContain('fd-setup');
      expect(out).not.toMatch(/NaN|undefined/);
    }
  });
});

/** Поле зі 100 рослин: перші елементи — задані стадії, решта — 12. */
function plantsWith(first: number[]): number[] { return [...first, ...Array.from({ length: 100 - first.length }, () => 12)]; }
