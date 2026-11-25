import { describe, expect, it } from 'vitest';
import { crops } from '../src/data/crops';
import { KEY_CODES, indexOfCode, keyStages, principalSegments, seasonStrip, showsStemSection } from '../src/engine/timeline';

const wheat = crops[0];
const codes = wheat.stages.map((s) => s.code);

describe('лінія розвитку: чиста логіка', () => {
  it('слайдер іде тільки по кодах шкали: немає 20, 34–36, 91', () => {
    for (const bad of [20, 34, 35, 36, 91]) expect(codes.includes(bad), String(bad)).toBe(false);
    expect(codes[0]).toBe(0);
    expect(codes[codes.length - 1]).toBe(99);
  });
  it('indexOfCode: наявний код → його індекс; відсутній → найближча наявна стадія', () => {
    expect(wheat.stages[indexOfCode(wheat, 32)].code).toBe(32);
    expect(wheat.stages[indexOfCode(wheat, 34)].code).toBe(33);
    expect(wheat.stages[indexOfCode(wheat, 20)].code).toBe(19);
    expect(wheat.stages[indexOfCode(wheat, 91)].code).toBe(92);
    expect(indexOfCode(wheat, 99)).toBe(codes.length - 1);
  });
  it('ключові фази існують у шкалі й іду́ть зростаючи', () => {
    const ks = keyStages(wheat).map((s) => s.code);
    expect(ks).toEqual([...KEY_CODES]);
    expect([...ks].sort((a, b) => a - b)).toEqual(ks);
  });
  it('головні стадії в смузі покривають усі фази шкали', () => {
    const seg = principalSegments(wheat);
    expect(seg.reduce((n, s) => n + s.count, 0)).toBe(wheat.stages.length);
    for (const s of seg) expect(wheat.stages.find((x) => x.code === s.firstCode)?.principal).toBe(s.id);
  });
  it('сезонна стрічка: п’ять сезонів по порядку; зима проміжна лише між осінню і весною', () => {
    const st = (c: number) => Object.fromEntries(seasonStrip(c).map((x) => [x.season, x.state]));
    expect(seasonStrip(0).map((x) => x.season)).toEqual(['autumn', 'winter', 'spring', 'earlySummer', 'summer']);
    expect(st(13)).toEqual({ autumn: 'active', winter: 'off', spring: 'off', earlySummer: 'off', summer: 'off' });
    expect(st(25)).toEqual({ autumn: 'active', winter: 'between', spring: 'active', earlySummer: 'off', summer: 'off' });
    expect(st(32).spring).toBe('active');
    expect(st(65)).toMatchObject({ spring: 'active', earlySummer: 'active', winter: 'off' });
    expect(st(89).summer).toBe('active');
  });
  it('розріз стебла лише для 29–49', () => {
    expect([28, 29, 33, 49, 51].map(showsStemSection)).toEqual([false, true, true, true, false]);
  });
});
