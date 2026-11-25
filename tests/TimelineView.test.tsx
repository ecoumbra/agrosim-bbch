import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { crops } from '../src/data/crops';
import { getDict } from '../src/i18n';
import { TimelineView } from '../src/components/TimelineView';

const wheat = crops[0];
const html = (code: number, lang: 'uk' | 'en' = 'uk', atlas = false) =>
  renderToStaticMarkup(<TimelineView lang={lang} t={getDict(lang)} code={code} onCode={() => {}} onOpenAtlas={atlas ? () => {} : undefined} />);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('TimelineView', () => {
  it('рендериться без NaN/undefined для кожного коду шкали, uk і en', () => {
    for (const s of wheat.stages) for (const lang of ['uk', 'en'] as const) {
      const out = html(s.code, lang);
      expect(out, `${s.code} ${lang}`).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
  it('слайдер: індексний, max = кількість стадій − 1, aria-valuetext має код і назву', () => {
    const out = html(32);
    expect(out).toContain(`max="${wheat.stages.length - 1}"`);
    expect(out).toContain(`value="${wheat.stages.findIndex((s) => s.code === 32)}"`);
    expect(out).toContain('aria-valuetext="BBCH 32 · Другий вузол ≥ 2 см над першим"');
  });
  it('показує назву, опис і позначку верифікації поточної стадії з даних', () => {
    const s = wheat.stages.find((x) => x.code === 39)!;
    const out = html(39);
    expect(out).toContain(s.name.uk);
    expect(out).toContain(s.description.uk);
    expect(out).toContain('badge v-' + s.verification);
  });
  it('розріз стебла є на 32 і немає на 71; на 71 — підказка', () => {
    expect(html(32)).toContain('stem-section');
    expect(html(71)).not.toContain('stem-section');
    expect(html(71)).toContain('29–49');
  });
  it('сезонна стрічка: 5 пунктів, активні відмічені aria-current; на 25 — осінь+весна і проміжна зима', () => {
    const out = html(25);
    expect(count(out, /<li data-state=/g)).toBe(5);
    expect(count(out, /data-state="active"/g)).toBe(2);
    expect(out).toContain('data-state="between"');
    expect(html(13)).not.toContain('data-state="between"');
    expect(html(13)).not.toContain('зимовий спокій');
    expect(out).toContain('без календарних дат');
  });
  it('кнопка «Відкрити в Атласі» лише коли передано onOpenAtlas', () => {
    expect(html(32)).not.toContain('Відкрити в Атласі');
    expect(html(32, 'uk', true)).toContain('Відкрити в Атласі');
  });
  it('кнопки «назад» вимкнена на 00, «вперед» вимкнена на 99', () => {
    expect(html(0)).toMatch(/<button[^>]*disabled[^>]*aria-label="Попередня фаза"/);
    expect(html(99)).toMatch(/<button[^>]*disabled[^>]*aria-label="Наступна фаза"/);
    expect(html(32)).not.toMatch(/disabled=""[^>]*aria-label="Попередня фаза"/);
  });
});
