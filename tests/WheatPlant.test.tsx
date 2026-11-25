import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { crops } from '../src/data/crops';
import { WheatPlant } from '../src/components/WheatPlant';
import { lerpModel, plantModel } from '../src/engine/plantModel';

const html = (code: number) => renderToStaticMarkup(<WheatPlant model={plantModel(code)} label={`BBCH ${code}`} soilLabel="ґрунт" />);

describe('WheatPlant', () => {
  it('малюється без NaN/undefined для кожного коду шкали зернових', () => {
    for (const s of crops[0].stages) {
      const out = html(s.code);
      expect(out, `BBCH ${s.code}`).not.toMatch(/NaN|undefined|Infinity/);
      expect(out).toContain('role="img"');
      expect(out).toContain(`aria-label="BBCH ${s.code}"`);
    }
  });
  it('малюється для проміжних станів анімації (інтерполяція між усіма сусідніми фазами)', () => {
    const codes = crops[0].stages.map((s) => s.code);
    for (let i = 1; i < codes.length; i++) {
      for (const t of [0.25, 0.5, 0.75]) {
        const out = renderToStaticMarkup(<WheatPlant model={lerpModel(plantModel(codes[i - 1]), plantModel(codes[i]), t)} label="x" />);
        expect(out, `${codes[i - 1]}→${codes[i]} @${t}`).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });
  it('однаковий код дає однаковий малюнок (без випадковості)', () => {
    expect(html(65)).toBe(html(65));
  });
  it('пагони кущіння не зникають після BBCH 90, хоча шкала їх уже не лічить', () => {
    const count = (c: number) => (html(c).match(/<ellipse/g) ?? []).length;
    expect(plantModel(92).tillers).toBe(0);
    expect(count(92)).toBeGreaterThan(count(10));
    expect(html(92).match(/stroke-width="3.2"/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });
  it('на 99 надземна частина — стерня, а не рослина', () => {
    expect(html(99)).not.toContain('stroke-width="4.4"');
  });
});
