import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { crops } from '../src/data/crops';
import { getDict } from '../src/i18n';
import { QuestionView, SetupView, SummaryView, TrainerView } from '../src/components/TrainerView';
import { type Level, type Question, type Stats, check, recordAnswer, summarize } from '../src/engine/trainer';
import type { Photo } from '../src/types';

const crop = crops[0];
const stage = (c: number) => crop.stages.find((s) => s.code === c)!;
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const mk = (level: Level, code: number, options: number[], correct: number, section = false): Question => ({ id: `q-${code}`, level, visual: 'svg', code, options, correct, section });
const noop = () => {};

const question = (q: Question, choice: number | null, lang: 'uk' | 'en' = 'uk', isLast = false, atlas = false) =>
  renderToStaticMarkup(<QuestionView q={q} index={2} total={10} crop={crop} lang={lang} t={getDict(lang)} choice={choice} onChoose={noop} onNext={noop} onStop={noop} onOpenAtlas={atlas ? noop : undefined} isLast={isLast} />);

describe('екран налаштувань', () => {
  const setup = (over: Partial<{ stats: Stats; weakList: number[]; empty: boolean; level: Level }> = {}, lang: 'uk' | 'en' = 'uk') =>
    renderToStaticMarkup(<SetupView t={getDict(lang)} level={over.level ?? 'phase'} onLevel={noop} weak={false} onWeak={noop} weakList={over.weakList ?? []} stats={over.stats ?? {}} onStart={noop} onResetStats={noop} empty={over.empty ?? false} />);
  it('три рівні, обраний позначено; без слабких місць прапорець вимкнено; статистики немає', () => {
    const out = setup();
    expect(count(out, /type="radio"/g)).toBe(3);
    expect(out).toMatch(/<input type="radio" name="level" checked="" value="phase"/);
    expect(count(out, /type="radio"[^>]*checked=""/g)).toBe(1);
    expect(out).toMatch(/type="checkbox"[^>]*disabled/);
    expect(out).toContain('Слабких місць поки немає');
    expect(out).toContain('Статистики ще немає');
    expect(out).not.toContain('Скинути статистику');
  });
  it('статистика й слабкі місця: відсоток, перелік кодів, кнопка скидання, прапорець доступний', () => {
    let st: Stats = {};
    for (const [c, ok] of [[37, false], [37, true], [13, true], [13, true]] as [number, boolean][]) st = recordAnswer(st, c, ok);
    const out = setup({ stats: st, weakList: [37] });
    expect(out).toContain('3 з 4 правильних відповідей (75%)');
    expect(out).toContain('Слабкі місця: 37.');
    expect(out).toContain('Скинути статистику');
    expect(out).not.toMatch(/type="checkbox"[^>]*disabled/);
  });
  it('повідомлення про порожню сесію і англійська мова', () => {
    expect(setup({ empty: true })).toContain('role="alert"');
    expect(setup({}, 'en')).toContain('Trainer: “Name the stage”');
  });
});

describe('екран питання: не видає відповіді до вибору', () => {
  const q37 = mk('phase', 37, [39, 33, 37, 31], 37, true);
  it('жодної підказки з правильної фази: ні опису, ні «Як визначити», ні коду в aria-label, розріз без підписів-пояснень', () => {
    const out = question(q37, null);
    expect(out).not.toContain(stage(37).description.uk);
    expect(out).not.toContain(stage(37).howToCheck!.uk);
    expect(out).not.toContain('stem-note');
    expect(out).not.toContain('<figcaption');
    const labels = [...out.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(2);
    for (const l of labels) expect(l, l).not.toMatch(/BBCH\s*\d|37/);
    expect(out).not.toContain('tr-feedback');
  });
  it('4 варіанти з клавішами 1–4 у наданому порядку, усі активні; підказка про клавіші; прогрес «Питання 3 з 10»', () => {
    const out = question(q37, null);
    expect(count(out, /class="tr-opt"/g)).toBe(4);
    expect([...out.matchAll(/<kbd[^>]*>(\d)<\/kbd>/g)].map((m) => m[1])).toEqual(['1', '2', '3', '4']);
    expect(out).not.toMatch(/class="tr-opt"[^>]*disabled/);
    expect(out).toContain('Клавіші 1–4 обирають варіант.');
    expect(out).toContain('Питання 3 з 10');
    expect(out).toContain('Яка це фаза за шкалою BBCH?');
  });
  it('питання з розрізом: перемикач «Рослина / Розріз стебла», розріз прихований за замовчуванням; без розрізу перемикача немає', () => {
    const out = question(q37, null);
    expect(out).toContain('tr-seg');
    expect(count(out, /class="tr-fig" hidden=""/g)).toBe(1);
    const plain = question(mk('phase', 13, [11, 12, 13, 14], 13), null);
    expect(plain).not.toContain('tr-seg');
    expect(plain).not.toContain('stem-section');
  });
  it('головна стадія: варіанти — «Головна стадія N: назва»', () => {
    const out = question(mk('principal', 13, [3, 1, 2, 4], 1), null);
    expect(out).toContain('Головна стадія 1:');
    expect(out).toContain('Яка головна стадія розвитку на малюнку?');
  });
});

describe('екран питання: розбір відповіді', () => {
  const q = mk('phase', 37, [39, 33, 37, 31], 37, true);
  it('помилка між сусідніми фазами: правильний/хибний/приглушені варіанти, обидві фази, «Як визначити», застереження про плутанину', () => {
    const out = question(q, 39, 'uk', false, true);
    expect(out).toContain('Не зовсім.');
    expect(count(out, /data-state="correct"/g)).toBe(1);
    expect(count(out, /data-state="wrong"/g)).toBe(1);
    expect(count(out, /data-state="dim"/g)).toBe(2);
    expect(count(out, /class="tr-opt"[^>]*disabled=""/g)).toBe(4);
    expect(out).toContain(stage(37).description.uk);
    expect(out).toContain(stage(37).howToCheck!.uk);
    expect(out).toContain(stage(39).description.uk);
    expect(out).toContain('Ці фази часто плутають');
    expect(out).toContain('Відкрити в Атласі');
    expect(out).toContain('>Далі<');
  });
  it('правильна відповідь: «Правильно!», без блоку «Ви обрали» і без застережень; на останньому питанні — «До підсумку»', () => {
    const out = question(q, 37, 'uk', true);
    expect(out).toContain('Правильно!');
    expect(out).not.toContain('Ви обрали');
    expect(out).not.toContain('Ці фази часто плутають');
    expect(out).toContain('До підсумку');
  });
  it('помилка між несуміжними фазами не називається «часто плутають»', () => {
    expect(question(q, 31)).not.toContain('Ці фази часто плутають');
  });
  it('головна стадія: після відповіді показано фазу на малюнку', () => {
    const out = question(mk('principal', 13, [3, 1, 2, 4], 1), 3);
    expect(out).toContain('На малюнку була фаза');
    expect(out).toContain(stage(13).description.uk);
  });
  it('англійська: без NaN/undefined', () => {
    for (const c of [null, 39, 37]) expect(question(q, c, 'en')).not.toMatch(/NaN|undefined/);
  });
});

describe('екран підсумку', () => {
  const qs = [mk('phase', 37, [37, 39, 33, 31], 37), mk('phase', 39, [39, 37, 41, 45], 39), mk('phase', 13, [13, 14, 12, 11], 13)];
  const view = (answers: ReturnType<typeof check>[], used = qs) =>
    renderToStaticMarkup(<SummaryView summary={summarize(crop, used, answers)} crop={crop} lang="uk" t={getDict('uk')} level="phase" onRetry={noop} onAgain={noop} onBack={noop} onOpenAtlas={noop} />);
  it('рахунок, групи за головними стадіями, помилки, сплутана пара ×2, кнопка «Повторити помилки»', () => {
    const out = view([check(qs[0], 39), check(qs[1], 37), check(qs[2], 13)]);
    expect(out).toContain('1 з 3 правильно (33%)');
    expect(out).toContain('<b>0/2</b>');
    expect(out).toContain('<b>1/1</b>');
    expect(out).toContain('37 · ');
    expect(out).toMatch(/37 · [^<]* ↔ 39 · [^<]* ×2/);
    expect(out).toContain('Повторити помилки');
  });
  it('без помилок: похвала, без розділу помилок і без «Повторити»', () => {
    const out = view(qs.map((q) => check(q, q.correct)));
    expect(out).toContain('3 з 3 правильно (100%)');
    expect(out).toContain('Без помилок. Відмінно!');
    expect(out).not.toContain('Повторити помилки');
    expect(out).not.toContain('tr-mist');
  });
  it('порожня сесія не ламає екран', () => {
    expect(view([])).not.toMatch(/NaN|undefined/);
  });
});

describe('TrainerView', () => {
  it('починає з екрана налаштувань; вкладка працює українською й англійською', () => {
    for (const lang of ['uk', 'en'] as const) {
      const out = renderToStaticMarkup(<TrainerView lang={lang} t={getDict(lang)} />);
      expect(out).toContain('tr-setup');
      expect(out).not.toMatch(/NaN|undefined/);
    }
  });
});

describe('режим «фото»', () => {
  // Макет запису (TEST_FIXTURE): не справжнє фото.
  const photo: Photo = {
    id: 'winter-wheat-32-ab12cd', crop: 'winter-wheat', code: 32, source: 'https://commons.wikimedia.org/wiki/File:TEST_FIXTURE_Wheat_32.jpg',
    author: 'Test Author', license: 'CC BY-SA 4.0', attribution: 'Test Author, CC BY-SA 4.0, Wikimedia Commons', file: 'p-0123456789ab.jpg', checked: '2026-11-01', verifiedBy: 'source',
  };
  const q: Question = { id: 'ph-32', level: 'phase', visual: 'photo', code: 32, options: [31, 32, 33, 13], correct: 32, section: false };
  const view = (choice: number | null, lang: 'uk' | 'en' = 'uk') =>
    renderToStaticMarkup(<QuestionView q={q} index={0} total={4} crop={crop} lang={lang} t={getDict(lang)} choice={choice} onChoose={noop} onNext={noop} onStop={noop} isLast={false} photo={photo} photoBase="./" />);
  const setup = (over: Partial<{ photoCount: number; photoPhases: number; mode: 'svg' | 'photo'; loading: boolean; photoFail: boolean; empty: boolean }>) =>
    renderToStaticMarkup(<SetupView t={getDict('uk')} level="phase" onLevel={noop} weak={false} onWeak={noop} weakList={[]} stats={{}} onStart={noop} onResetStats={noop} empty={over.empty ?? false} mode={over.mode ?? 'svg'} onMode={noop} photoCount={over.photoCount} photoPhases={over.photoPhases} loading={over.loading} photoFail={over.photoFail} />);

  it('налаштування без фото: повідомлення, вибору режиму немає', () => {
    const out = setup({});
    expect(out).toContain('Фото ще не додано');
    expect(out).not.toContain('name="mode"');
  });
  it('налаштування з фото: два режими, обраний позначено, лічильник; під час завантаження кнопка вимкнена', () => {
    const out = setup({ photoCount: 5, photoPhases: 3, mode: 'photo' });
    expect(count(out, /name="mode"/g)).toBe(2);
    expect(out).toMatch(/name="mode" checked="" value="photo"/);
    expect(out).toContain('Фото в колекції: 5 для 3 фаз.');
    expect(out).not.toContain('Фото ще не додано');
    expect(setup({ photoCount: 5, photoPhases: 3, loading: true })).toMatch(/<button[^>]*disabled[^>]*>Завантажуємо фото…/);
    expect(setup({ empty: true, photoFail: true })).toContain('Фото не вдалося завантажити');
  });
  it('питання з фото: img із нейтральними alt і ім’ям файлу, підпис автора, без SVG-рослини; посилання на джерело лише після відповіді', () => {
    const before = view(null);
    expect(before).toContain('<img src="./photos/p-0123456789ab.jpg" alt="Фото рослини пшениці до питання"');
    expect(before).toContain('Фото: Test Author, CC BY-SA 4.0, Wikimedia Commons');
    expect(before).not.toContain('plant-wrap');
    expect(before).not.toContain('<a href=');
    const after = view(31);
    expect(after).toContain(`<a href="${photo.source}" target="_blank" rel="noopener noreferrer">Сторінка файлу</a>`);
    expect(after).toContain('Не зовсім.');
  });
  it('до відповіді розмітка не видає фазу: ні source (з назвою файлу), ні id, ні коду в alt/aria-label', () => {
    const out = view(null);
    expect(out).not.toContain('TEST_FIXTURE');
    expect(out).not.toContain(photo.id);
    expect(out).not.toContain(photo.source);
    for (const m of out.matchAll(/(?:alt|aria-label)="([^"]*)"/g)) expect(m[1], m[1]).not.toMatch(/BBCH\s*\d|32/);
  });
  it('англійською без NaN/undefined; підсумок показує авторів фото сесії', () => {
    expect(view(32, 'en')).not.toMatch(/NaN|undefined/);
    expect(view(null, 'en')).toContain('Photo: Test Author');
    const sum = summarize(crop, [q], [check(q, 32)]);
    const out = renderToStaticMarkup(<SummaryView summary={sum} crop={crop} lang="uk" t={getDict('uk')} level="phase" onRetry={noop} onAgain={noop} onBack={noop} credits={[photo]} />);
    expect(out).toContain('Автори фото в цій сесії');
    expect(out).toContain('32: Test Author, CC BY-SA 4.0, Wikimedia Commons');
    expect(renderToStaticMarkup(<SummaryView summary={sum} crop={crop} lang="uk" t={getDict('uk')} level="phase" onRetry={noop} onAgain={noop} onBack={noop} />)).not.toContain('Автори фото');
  });
});
