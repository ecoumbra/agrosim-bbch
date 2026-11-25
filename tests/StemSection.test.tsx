import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { crops } from '../src/data/crops';
import { NODE_CM, StemSection, stemCaptionLines } from '../src/components/StemSection';
import { plantModel } from '../src/engine/plantModel';

const html = (code: number, lang: 'uk' | 'en' = 'uk') => renderToStaticMarkup(<StemSection model={plantModel(code)} lang={lang} />);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const stage = (code: number) => crops[0].stages.find((s) => s.code === code)!;

describe('StemSection (розріз стебла)', () => {
  it('малюється без NaN/undefined для кожного коду шкали, українською й англійською', () => {
    for (const s of crops[0].stages) for (const lang of ['uk', 'en'] as const) {
      const out = html(s.code, lang);
      expect(out, `BBCH ${s.code} ${lang}`).not.toMatch(/NaN|undefined|Infinity/);
      expect(out).toContain('role="img"');
    }
  });
  it('відстані вузлів збігаються з числами в тексті шкали (1 / 2 / 2 см) і дають кумулятивні 1 / 3 / 5', () => {
    expect(NODE_CM).toEqual([1, 3, 5]);
    expect(stage(31).description.uk).toMatch(/1 см/);
    expect(stage(32).description.uk).toMatch(/2 см/);
    expect(stage(33).description.uk).toMatch(/2 см/);
    expect(stage(30).description.uk).toMatch(/1 см/);
    expect(stage(32).name.uk).toMatch(/2 см/);
  });
  it('кількість видимих вузлів: 0 до 31, далі 1, 2, 3 і лишається 3', () => {
    const vis = (c: number) => count(html(c), /data-node="\d" data-visible="true"/g);
    expect([29, 30, 31, 32, 33, 37, 45].map(vis)).toEqual([0, 0, 1, 2, 3, 3, 3]);
  });
  it('точка росту видима лише до 30, зачаток колоса — на 30–33, на 30 без позначки «схематично»', () => {
    const flag = (c: number, apex: string) => html(c).includes(`data-apex="${apex}" data-visible="true"`);
    expect([29, 30, 33, 37].map((c) => flag(c, 'vegetative'))).toEqual([true, false, false, false]);
    expect([29, 30, 33, 37].map((c) => flag(c, 'primordium'))).toEqual([false, true, true, false]);
    expect(html(30)).toContain('data-schematic="false"');
    expect(html(31)).toContain('data-schematic="true"');
  });
  it('підписи: шкальні кроки й позначені похідні суми; після 33 відстаней немає', () => {
    expect(stemCaptionLines(plantModel(30), 'uk')[0]).toMatch(/щонайменше на 1 см вище вузла кущіння/);
    const c33 = stemCaptionLines(plantModel(33), 'uk');
    expect(c33).toHaveLength(3);
    expect(c33[1]).toMatch(/щонайменше 2 см над вузлом 1/);
    expect(c33[1]).toMatch(/≥ 3 см/);
    expect(c33[2]).toMatch(/щонайменше 2 см над вузлом 2/);
    expect(c33[2]).toMatch(/≥ 5 см/);
    expect(c33[2]).toMatch(/похідне/);
    expect(stemCaptionLines(plantModel(33), 'en')[2]).toMatch(/at least 2 cm above node 2/);
    expect(stemCaptionLines(plantModel(40), 'uk')).toHaveLength(1);
    expect(stemCaptionLines(plantModel(40), 'uk')[0]).not.toMatch(/\d+ см/);
  });
  it('завжди є застереження про мінімальні відстані й схематичність', () => {
    expect(html(32)).toContain('stem-note');
    expect(html(32)).toMatch(/мінімальних відстанях/);
    expect(html(32, 'en')).toMatch(/minimum distances/);
  });
});
