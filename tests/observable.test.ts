import { describe, expect, it } from 'vitest';
import { crops } from '../src/data/crops';
import { distinguishable, observableKey } from '../src/engine/observable';
import { plantModel, visibleTillers } from '../src/engine/plantModel';

const codes = crops[0].stages.map((s) => s.code);

describe('що на малюнку можна розрізнити (observableKey)', () => {
  it('нерозрізнювані на малюнку групи фаз — рівно ці (регресійний захист евристики)', () => {
    const groups = new Map<string, number[]>();
    for (const c of codes) { const k = observableKey(c); groups.set(k, [...(groups.get(k) ?? []), c]); }
    const same = [...groups.values()].filter((g) => g.length > 1);
    expect(same).toEqual([[10, 11], [25, 26, 27, 28], [41, 43], [52, 53], [55, 56, 57], [75, 77]]);
    expect(groups.size).toBe(52);
  });
  it('сусідні фази, які шкала розрізняє видимою ознакою, розрізнюються: вузли 31/32/33, листки 12/13, колос 59/65', () => {
    for (const [a, b] of [[31, 32], [32, 33], [12, 13], [13, 14], [59, 65], [29, 30], [37, 39]]) expect(distinguishable(a, b, true) || distinguishable(a, b, false), `${a}/${b}`).toBe(true);
    expect(distinguishable(31, 32, true)).toBe(true);
    expect(distinguishable(32, 33, true)).toBe(true);
  });
  it('пагони кущіння 25–29 на малюнку однакові (5), тож без розрізу їх не розрізнити; з розрізом 29 відрізняється лише ознакою розрізу', () => {
    expect(distinguishable(25, 28, false)).toBe(false);
    expect(distinguishable(28, 29, false)).toBe(false);
    expect(distinguishable(28, 29, true)).toBe(false);
  });
  it('прапорець розрізу змінює відбиток; 49 і 51 без розрізу однакові', () => {
    expect(observableKey(51, true)).not.toBe(observableKey(51, false));
    expect(observableKey(49, false)).toBe(observableKey(51, false));
  });
  it('distinguishable симетрична', () => {
    for (const a of codes) for (const b of [10, 32, 65, 89]) expect(distinguishable(a, b, false)).toBe(distinguishable(b, a, false));
  });
});

describe('visibleTillers', () => {
  it('наростає до 5, лишається 5 після 30 і навіть після 90 (шкала їх уже не лічить)', () => {
    expect([10, 20, 21, 23, 25, 29, 30, 65, 92, 99].map((c) => visibleTillers(plantModel(c)))).toEqual([0, 0, 1, 3, 5, 5, 5, 5, 5, 5]);
    expect(plantModel(92).tillers).toBe(0);
  });
});
