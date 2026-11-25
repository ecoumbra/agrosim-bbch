import { describe, expect, it } from 'vitest';
import { clamp01, culmAngle, culmPoint, hash, leafShape, mix, ribbon } from '../src/engine/plantGeometry';

describe('геометрія SVG-рослини', () => {
  it('mix змішує кольори й обмежує t відрізком 0…1', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#ffffff', -3)).toBe('#102030');
    expect(mix('#fff', '#000', 2)).toBe('#000000');
  });
  it('hash детермінований і лежить у [0, 1)', () => {
    for (let i = 0; i < 200; i++) { const h = hash(i); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); expect(hash(i)).toBe(h); }
  });
  it('clamp01 обрізає значення', () => {
    expect([clamp01(-1), clamp01(0.4), clamp01(9)]).toEqual([0, 0.4, 1]);
  });
  it('листок: замкнений контур без NaN, верхівка відхилена в бік вигину', () => {
    const l = leafShape(100, 300, 20, 100, 30, 8);
    expect(l.blade.startsWith('M')).toBe(true);
    expect(l.blade.endsWith('Z')).toBe(true);
    expect(l.blade).not.toMatch(/NaN|undefined/);
    expect(l.rib).not.toMatch(/NaN|undefined/);
    expect(l.tip.x).toBeGreaterThan(100);
    expect(l.tip.y).toBeLessThan(300);
    expect(leafShape(100, 300, -20, 100, -30, 8).tip.x).toBeLessThan(100);
  });
  it('стебло: t=0 — основа, t=1 — верхівка; прямий стебель вертикальний', () => {
    const c = { x0: 50, y0: 400, h: 200, reach: 0 };
    expect(culmPoint(c, 0)).toEqual({ x: 50, y: 400 });
    expect(culmPoint(c, 1)).toEqual({ x: 50, y: 200 });
    expect(culmAngle(c, 0.5)).toBeCloseTo(0, 6);
    const lean = { ...c, reach: 40 };
    expect(culmPoint(lean, 1).x).toBeCloseTo(90, 6);
    expect(culmAngle(lean, 1)).toBeGreaterThan(0);
  });
  it('ribbon будує замкнений контур', () => {
    const d = ribbon([{ x: 0, y: 0 }, { x: 0, y: -10 }, { x: 0, y: -20 }], [1, 2, 1]);
    expect(d.startsWith('M') && d.endsWith('Z')).toBe(true);
  });
});
