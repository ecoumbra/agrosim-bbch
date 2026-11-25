import { describe, expect, it } from 'vitest';
import { FILE_RE, ID_RE, hasCodeLeak, isAllowedLicense, isCommonsImageHost, isIsoDate, normalizeLicense, stripHtml } from '../src/engine/photoRules.mjs';

describe('ліцензії: дозволені лише CC0, CC BY, CC BY-SA, Public domain', () => {
  it('нормалізує дозволені записи до канонічної форми', () => {
    const ok: [string, string][] = [
      ['CC0', 'CC0'], ['CC0 1.0', 'CC0'], ['CC0 1.0 Universal', 'CC0'], ['cc0', 'CC0'],
      ['CC BY 4.0', 'CC BY 4.0'], ['CC-BY-2.0', 'CC BY 2.0'], ['cc by 3.0', 'CC BY 3.0'], ['CC BY 4.0 International', 'CC BY 4.0'],
      ['CC BY-SA 4.0', 'CC BY-SA 4.0'], ['CC-BY-SA-3.0', 'CC BY-SA 3.0'], ['CC BY-SA 2.5 Generic', 'CC BY-SA 2.5'], ['  CC BY-SA   4.0 ', 'CC BY-SA 4.0'],
      ['Public domain', 'Public domain'], ['public domain', 'Public domain'], ['PD', 'Public domain'], ['PD-old', 'Public domain'], ['PD-self', 'Public domain'], ['PD-USGov', 'Public domain'],
    ];
    for (const [raw, canon] of ok) expect(normalizeLicense(raw), raw).toBe(canon);
  });
  it('відхиляє NC, ND, GFDL, «усі права захищені», порожнє й сміття', () => {
    const bad = ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', 'CC BY-NC-ND 2.0', 'CC BY-SA-NC 4.0', 'CC BY 2.0 NC', 'CC BY-SA 4.0 ND', 'GFDL', 'GFDL 1.2', 'Fair use', 'All rights reserved', 'Copyrighted free use', 'CC BY', 'CC BY-SA', 'CC', 'CC0 NC', 'PDX Portland', '', '   '];
    for (const raw of bad) expect(normalizeLicense(raw), `«${raw}»`).toBeNull();
    for (const raw of [null, undefined, 4, {}, []]) expect(normalizeLicense(raw)).toBeNull();
  });
  it('isAllowedLicense: у маніфесті лише канонічний запис', () => {
    for (const s of ['CC0', 'CC BY 4.0', 'CC BY-SA 3.0', 'Public domain']) expect(isAllowedLicense(s), s).toBe(true);
    for (const s of ['cc by 4.0', 'CC-BY-4.0', 'CC BY-NC 4.0', 'PD', 'CC BY', '']) expect(isAllowedLicense(s), `«${s}»`).toBe(false);
  });
});

describe('допоміжні правила', () => {
  it('stripHtml прибирає теги й розкодовує сутності', () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X" title="User:X">Іван&nbsp;Петренко</a>')).toBe('Іван Петренко');
    expect(stripHtml('A &amp; B<br/>C &lt;3 &quot;q&quot; &#39;s&#39; &#1030;')).toBe('A & B C <3 "q" \'s\' І');
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml('  \n a \t b ')).toBe('a b');
  });
  it('FILE_RE вимагає нейтральне ім’я p-<hex>.<ext>', () => {
    for (const f of ['p-0123456789ab.jpg', 'p-abcdef012345.png', 'p-aaaaaaaa.webp']) expect(FILE_RE.test(f), f).toBe(true);
    for (const f of ['wheat-32.jpg', 'p-xyz.jpg', 'p-0123456789ab.gif', '../p-0123456789ab.jpg', 'p-0123456789ab.jpg.exe', 'P-0123456789AB.jpg', 'p-1234567.jpg']) expect(FILE_RE.test(f), f).toBe(false);
  });
  it('ID_RE: a-z, 0-9, дефіс, 3–80 символів', () => {
    expect(ID_RE.test('winter-wheat-32-ab12cd')).toBe(true);
    for (const s of ['', 'ab', 'A-b-c', 'a b c', '-abc', 'a_b_c']) expect(ID_RE.test(s), s).toBe(false);
  });
  it('isIsoDate приймає лише існуючі дати', () => {
    expect(isIsoDate('2026-11-21')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    for (const s of ['2026-02-30', '2026-13-01', '2026-1-1', '21.11.2026', '', 'вчора', 20261121]) expect(isIsoDate(s), String(s)).toBe(false);
  });
  it('hasCodeLeak: «BBCH» і двозначні числа підказують відповідь; роки й версії ліцензій — ні', () => {
    for (const s of ['Photo 32', 'BBCH', 'bbch stage', 'Автор 45, CC BY 4.0']) expect(hasCodeLeak(s), s).toBe(true);
    for (const s of ['Ivan Petrenko, CC BY-SA 4.0, Wikimedia Commons', 'Автор 2019', 'CC BY 2.0']) expect(hasCodeLeak(s), s).toBe(false);
  });
  it('isCommonsImageHost: лише https://upload.wikimedia.org', () => {
    expect(isCommonsImageHost('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/1200px-X.jpg')).toBe(true);
    for (const u of ['http://upload.wikimedia.org/x.jpg', 'https://evil.example/x.jpg', 'https://upload.wikimedia.org.evil.example/x.jpg', 'не url', '', undefined]) expect(isCommonsImageHost(u), String(u)).toBe(false);
  });
});
