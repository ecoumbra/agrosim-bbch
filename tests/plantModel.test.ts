import { describe, expect, it } from 'vitest';
import { crops } from '../src/data/crops';
import { SEASON_ORDER, lerpModel, plantModel, seasonOf } from '../src/engine/plantModel';

const codes = crops[0].stages.map((s) => s.code);
const mono = (f: (c: number) => number, from: number, to: number) => {
  const list = codes.filter((c) => c >= from && c <= to);
  for (let i = 1; i < list.length; i++) expect(f(list[i]), `${list[i - 1]}→${list[i]}`).toBeGreaterThanOrEqual(f(list[i - 1]) - 1e-9);
};

describe('модель рослини за кодом BBCH', () => {
  it('листки 11–19 дорівнюють коду − 10; кущіння 21–29 — коду − 20', () => {
    for (let c = 11; c <= 19; c++) expect(plantModel(c).leaves).toBe(c - 10);
    for (let c = 21; c <= 29; c++) expect(plantModel(c).tillers).toBe(c - 20);
  });
  it('вузли й мінімальні відстані відповідають визначенням 30–33', () => {
    expect(plantModel(30).primordiumMinCm).toBe(1);
    expect(plantModel(31).nodeMinCm).toEqual([1]);
    expect(plantModel(32).nodeMinCm).toEqual([1, 3]);
    expect(plantModel(33).nodeMinCm).toEqual([1, 3, 5]);
    expect(plantModel(29).nodeMinCm).toEqual([]);
  });
  it('точка росту: нижче ґрунту до 30, піднімається 30–36, у колосі від 37', () => {
    expect(plantModel(29).growingPoint).toBe('below');
    expect(plantModel(33).growingPoint).toBe('rising');
    expect(plantModel(39).growingPoint).toBe('ear');
  });
  it('прапорцевий лист: немає до 37, згорнутий у 37, розгорнутий від 39', () => {
    expect(plantModel(33).flagLeaf).toBe('none');
    expect(plantModel(37).flagLeaf).toBe('rolled');
    expect(plantModel(39).flagLeaf).toBe('open');
  });
  it('частка колоса: 51 — початок, 55 — половина, 58 — 80 %, 59 — повністю', () => {
    expect(plantModel(55).head).toBeCloseTo(0.5);
    expect(plantModel(58).head).toBeCloseTo(0.8);
    expect(plantModel(59).head).toBe(1);
    expect(plantModel(51).head).toBeGreaterThan(0);
    expect(plantModel(50).head).toBe(0);
  });
  it('пиляки: нема до 61, максимум у повне цвітіння 65, висохлі з 69', () => {
    expect(plantModel(59).anthers).toBe(0);
    expect(plantModel(65).anthers).toBeGreaterThan(plantModel(61).anthers);
    expect(plantModel(65).anthers).toBeGreaterThan(plantModel(69).anthers);
    expect(plantModel(69).dryAnthers).toBe(1);
  });
  it('стиглість: зерно досягло розміру в 75 (зелене), нігтьовий тест 85 → 87, 89 повністю стигле', () => {
    expect(plantModel(75).grain).toBe(1);
    expect(plantModel(75).ripe).toBeLessThan(0.2);
    expect(plantModel(85).ripe).toBeLessThan(plantModel(87).ripe);
    expect(plantModel(89).ripe).toBe(1);
  });
  it('кінцеві фази: осипання 93, полягання 97, збір 99', () => {
    expect(plantModel(93).shedding).toBeGreaterThan(plantModel(92).shedding);
    expect(plantModel(97).lodged).toBe(true);
    expect(plantModel(96).lodged).toBe(false);
    expect(plantModel(99).harvested).toBe(true);
    expect(plantModel(97).harvested).toBe(false);
  });
  it('монотонність розвитку вздовж шкали', () => {
    mono((c) => plantModel(c).imbibition, 0, 9);
    mono((c) => plantModel(c).radicle, 5, 9);
    mono((c) => plantModel(c).leaves, 10, 39);
    mono((c) => plantModel(c).stem, 29, 59);
    mono((c) => plantModel(c).head, 49, 59);
    mono((c) => plantModel(c).grain, 69, 99);
    mono((c) => plantModel(c).ripe, 71, 99);
    mono((c) => plantModel(c).senescence, 71, 99);
    mono((c) => plantModel(c).roots, 5, 59);
  });
  it('усі значення у допустимих межах для кожної фази шкали', () => {
    for (const c of codes) {
      const m = plantModel(c);
      for (const k of ['imbibition', 'radicle', 'coleoptile', 'roots', 'stem', 'boot', 'head', 'anthers', 'grain', 'ripe', 'senescence', 'shedding'] as const) {
        expect(m[k], `${c}.${k}`).toBeGreaterThanOrEqual(0);
        expect(m[k], `${c}.${k}`).toBeLessThanOrEqual(1);
      }
    }
  });
  it('інтерполяція: кінці збігаються, середина між значеннями', () => {
    const a = plantModel(30), b = plantModel(39);
    expect(lerpModel(a, b, 0).stem).toBeCloseTo(a.stem);
    expect(lerpModel(a, b, 1).stem).toBeCloseTo(b.stem);
    const mid = lerpModel(a, b, 0.5).stem;
    expect(mid).toBeGreaterThan(a.stem);
    expect(mid).toBeLessThan(b.stem);
    expect(lerpModel(a, b, 1).code).toBe(39);
  });
});

describe('сезонна стрічка', () => {
  it('фази озимих зернових розподілені по сезонах без дат', () => {
    expect(seasonOf(9)).toEqual(['autumn']);
    expect(seasonOf(25)).toEqual(['autumn', 'spring']);
    expect(seasonOf(37)).toEqual(['spring']);
    expect(seasonOf(61)).toEqual(['spring', 'earlySummer']);
    expect(seasonOf(89)).toEqual(['summer']);
    expect(SEASON_ORDER).toHaveLength(5);
  });
});
