import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App';

describe('App', () => {
  it('рендериться; «Лінія розвитку» і «Тренажер» вже не позначені «скоро», польова діагностика теж без «скоро»', () => {
    const out = renderToStaticMarkup(<App />);
    expect(out).not.toMatch(/NaN|undefined/);
    const tab = (name: string) => out.match(new RegExp(`<button[^>]*role="tab"[^>]*>${name}(<em>[^<]*</em>)?</button>`))?.[0] ?? '';
    expect(tab('Лінія розвитку')).not.toBe('');
    expect(tab('Лінія розвитку')).not.toContain('<em>');
    expect(tab('Тренажер')).not.toBe('');
    expect(tab('Тренажер')).not.toContain('<em>');
    expect(tab('Польова діагностика')).not.toBe('');
    expect(tab('Польова діагностика')).not.toContain('<em>');
  });
});
