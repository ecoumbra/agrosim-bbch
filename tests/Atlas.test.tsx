import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { crops } from '../src/data/crops';
import { getDict } from '../src/i18n';
import { Atlas } from '../src/components/Atlas';

const html = (props: { initialCode?: number; withButton?: boolean } = {}, lang: 'uk' | 'en' = 'uk') =>
  renderToStaticMarkup(<Atlas lang={lang} t={getDict(lang)} initialCode={props.initialCode} onShowOnPlant={props.withButton ? () => {} : undefined} />);

describe('Атлас: перехід із лінії розвитку і кнопка «Показати на рослині»', () => {
  it('без initialCode відкрита головна стадія 3 і жодна фаза не розгорнута', () => {
    const out = html();
    expect(out).toContain('aria-expanded="false"');
    expect(out).not.toContain('aria-expanded="true"');
    expect(out).not.toContain('Показати на рослині');
  });
  it('initialCode розгортає картку цієї фази і вибирає її головну стадію', () => {
    const s = crops[0].stages.find((x) => x.code === 65)!;
    const out = html({ initialCode: 65, withButton: true });
    expect(out).toContain(`id="stage-65"`);
    expect(out).toMatch(/aria-expanded="true"/);
    expect(out).toContain(s.description.uk);
    expect(out).toContain(`Головна стадія ${s.principal}`);
  });
  it('кнопка є лише в розгорнутій картці й лише коли передано onShowOnPlant', () => {
    expect(html({ initialCode: 32 })).not.toContain('Показати на рослині');
    const out = html({ initialCode: 32, withButton: true });
    expect(out.match(/Показати на рослині/g)?.length).toBe(1);
    expect(html({ initialCode: 32, withButton: true }, 'en')).toContain('Show on the plant');
  });
  it('код, якого немає в шкалі (34), не ламає Атлас: нічого не розгортається', () => {
    const out = html({ initialCode: 34, withButton: true });
    expect(out).not.toContain('aria-expanded="true"');
    expect(out).not.toMatch(/NaN|undefined/);
  });
});
