import { describe, expect, it } from 'vitest';
import { fileNameFor, makeId, parseImageInfo, run } from '../scripts/fetch-photos.mjs';
import { FILE_RE, ID_RE } from '../src/engine/photoRules.mjs';
import { crops } from '../src/data/crops';
import { validateManifest } from '../src/engine/photos';

// УВАГА: відповіді API тут — тестові макети (TEST_FIXTURE), складені за описаною структурою Commons API.
// Вони перевіряють логіку скрипта, але НЕ підтверджують, що реальне API повертає саме такі поля: перший запуск на живому API перевіряє користувач.
const IMG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/TEST_FIXTURE.jpg/1200px-TEST_FIXTURE.jpg';
const DESC = 'https://commons.wikimedia.org/wiki/File:TEST_FIXTURE.jpg';
const api = (o: { license?: string; artist?: string | null; mime?: string; missing?: boolean; image?: string; desc?: string } = {}) =>
  o.missing ? { query: { pages: [{ title: 'File:TEST_FIXTURE.jpg', missing: true }] } } : {
    query: { pages: [{ pageid: 1, title: 'File:TEST_FIXTURE.jpg', imageinfo: [{
      thumburl: o.image ?? IMG, url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/TEST_FIXTURE.jpg', descriptionurl: o.desc ?? DESC, mime: o.mime ?? 'image/jpeg', size: 1234,
      extmetadata: { LicenseShortName: { value: o.license ?? 'CC BY-SA 4.0' }, ...(o.artist === null ? {} : { Artist: { value: o.artist ?? '<a href="//commons.wikimedia.org/wiki/User:Test">Test Author</a>' } }) },
    }] }] },
  };

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const bytes = (a: number[]) => new Uint8Array(a).buffer;

const norm = (p: string) => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
function memFs(files: Record<string, string> = {}) {
  const m = new Map<string, unknown>(Object.entries(files));
  return {
    m, keys: () => [...m.keys()].map(norm),
    fs: {
      readFile: async (p: string) => { const k = norm(p); if (!m.has(k)) throw new Error('ENOENT'); return m.get(k) as string; },
      writeFile: async (p: string, d: unknown) => { m.set(norm(p), d); },
      mkdir: async () => undefined,
    },
  };
}
type Reply = { ok: boolean; status: number; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> };
const reply = (body: unknown, ab: ArrayBuffer = new ArrayBuffer(0), ok = true, status = 200): Reply => ({ ok, status, json: async () => body, arrayBuffer: async () => ab });
/** Підробний fetch: API за title, файли за URL; веде журнал викликів. */
function fakeFetch(apiByTitle: Record<string, unknown>, files: Record<string, ArrayBuffer> = { [IMG]: bytes(JPEG) }) {
  const calls: { url: string; ua?: string }[] = [];
  const fetchImpl = async (url: string, init?: { headers?: Record<string, string> }): Promise<Reply> => {
    calls.push({ url, ua: init?.headers?.['User-Agent'] });
    if (url.startsWith('https://commons.wikimedia.org/w/api.php')) {
      const t = new URL(url).searchParams.get('titles') ?? '';
      return t in apiByTitle ? reply(apiByTitle[t]) : reply({}, undefined, false, 404);
    }
    return url in files ? reply(null, files[url]) : reply(null, undefined, false, 404);
  };
  return { fetchImpl, calls };
}

const ROOT = '/proj';
const CAND = `${ROOT}/scripts/photos.candidates.json`;
const MAN = `${ROOT}/src/data/photos.manifest.json`;
const cand = (over: Record<string, unknown> = {}) => ({ crop: 'winter-wheat', code: 32, title: 'File:TEST_FIXTURE.jpg', verifiedBy: 'source', ...over });
const NOW = () => new Date('2026-11-21T10:00:00Z');
const go = (files: Record<string, string>, f: ReturnType<typeof fakeFetch>, argv: string[] = [], env: Record<string, string> = { COMMONS_CONTACT: 'test@example.org' }) => {
  const mem = memFs(files); const logs: string[] = [];
  return { mem, logs, p: run({ argv, env, root: ROOT, fetchImpl: f.fetchImpl, fs: mem.fs, log: (m) => logs.push(m), now: NOW, delayMs: 0 }) };
};
const manifestOf = (mem: ReturnType<typeof memFs>) => JSON.parse(mem.m.get(MAN) as string);

describe('parseImageInfo (на макетах відповіді)', () => {
  it('правильна відповідь: ліцензія нормалізується, автор без HTML, URL з upload.wikimedia.org', () => {
    const r = parseImageInfo(api());
    expect(r).toEqual({ ok: true, info: { descriptionUrl: DESC, imageUrl: IMG, ext: 'jpg', mime: 'image/jpeg', license: 'CC BY-SA 4.0', licenseRaw: 'CC BY-SA 4.0', author: 'Test Author' } });
  });
  it('відхилення з причинами: NC/ND/GFDL, відсутній файл, немає автора, тип, чужий хост, чужа сторінка', () => {
    const why = (x: unknown, o?: { authorOverride?: string }) => { const r = parseImageInfo(x, o); return r.ok ? 'OK' : r.reason; };
    expect(why(api({ license: 'CC BY-NC 4.0' }))).toMatch(/не дозволена/);
    expect(why(api({ license: 'CC BY-ND 2.0' }))).toMatch(/не дозволена/);
    expect(why(api({ license: 'GFDL' }))).toMatch(/не дозволена/);
    expect(why(api({ license: '' }))).toMatch(/не вказана/);
    expect(why(api({ missing: true }))).toMatch(/не знайдено/);
    expect(why({})).toMatch(/не знайдено/);
    expect(why({ query: { pages: {} } })).toMatch(/не знайдено/);
    expect(why(api({ artist: null }))).toMatch(/автора/);
    expect(why(api({ artist: null }), { authorOverride: 'Ім’я з сайту' })).toBe('OK');
    expect(why(api({ mime: 'image/gif' }))).toMatch(/тип файлу/);
    expect(why(api({ image: 'https://evil.example/x.jpg' }))).toMatch(/upload\.wikimedia\.org/);
    expect(why(api({ desc: 'https://evil.example/wiki/File:X.jpg' }))).toMatch(/commons\.wikimedia\.org/);
  });
});

describe('нейтральні імена', () => {
  it('fileNameFor і makeId детерміновані, відповідають правилам і не містять коду фази', () => {
    const f = fileNameFor('File:Wheat BBCH 32.jpg', 'jpg');
    expect(f).toBe(fileNameFor('File:Wheat BBCH 32.jpg', 'jpg'));
    expect(f).not.toBe(fileNameFor('File:Інше.jpg', 'jpg'));
    expect(FILE_RE.test(f)).toBe(true);
    expect(f).not.toMatch(/wheat|bbch/i);
    expect(ID_RE.test(makeId('winter-wheat', 32, 'File:Wheat BBCH 32.jpg'))).toBe(true);
  });
});

describe('run: завантаження з підробним API й файловою системою в пам’яті', () => {
  it('без контакту для User-Agent — зрозуміла помилка', async () => {
    const { p } = go({ [CAND]: '[]' }, fakeFetch({}), [], {});
    await expect(p).rejects.toThrow(/COMMONS_CONTACT/);
  });
  it('успіх: файл під нейтральним іменем, запис маніфесту, що проходить валідатор застосунку; User-Agent із контактом', async () => {
    const f = fakeFetch({ 'File:TEST_FIXTURE.jpg': api() });
    const { mem, p } = go({ [CAND]: JSON.stringify([cand()]) }, f);
    const r = await p;
    expect(r).toEqual({ added: ['File:TEST_FIXTURE.jpg'], skipped: [], rejected: [] });
    const m = manifestOf(mem);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ crop: 'winter-wheat', code: 32, source: DESC, author: 'Test Author', license: 'CC BY-SA 4.0', attribution: 'Test Author, CC BY-SA 4.0, Wikimedia Commons', checked: '2026-11-21', verifiedBy: 'source' });
    expect(validateManifest(m, crops, '2026-11-21')).toEqual([]);
    expect(mem.keys()).toContain(`${ROOT}/public/photos/${m[0].file}`);
    expect(f.calls.every((c) => c.ua?.includes('test@example.org'))).toBe(true);
    expect(f.calls[0].url).toContain('titles=File%3ATEST_FIXTURE.jpg');
    expect(f.calls[0].url).toContain('extmetadata');
  });
  it('--dry-run: перевіряє ліцензії, але нічого не завантажує й не записує', async () => {
    const f = fakeFetch({ 'File:TEST_FIXTURE.jpg': api() });
    const { mem, p } = go({ [CAND]: JSON.stringify([cand()]) }, f, ['--dry-run']);
    expect((await p).added).toHaveLength(1);
    expect(mem.keys()).toEqual([CAND]);
    expect(f.calls).toHaveLength(1);
  });
  it('ліцензія NC відхиляється: файл і маніфест не змінюються', async () => {
    const f = fakeFetch({ 'File:TEST_FIXTURE.jpg': api({ license: 'CC BY-NC-SA 4.0' }) });
    const { mem, p } = go({ [CAND]: JSON.stringify([cand()]) }, f);
    const r = await p;
    expect(r.added).toEqual([]);
    expect(r.rejected[0].reason).toMatch(/не дозволена/);
    expect(mem.keys()).toEqual([CAND]);
    expect(f.calls).toHaveLength(1);
  });
  it('відсутній файл на Commons, відсутній автор (і виправлення через author), підпис із двозначним числом', async () => {
    const f = fakeFetch({ 'File:A.jpg': api({ missing: true }), 'File:B.jpg': api({ artist: null }), 'File:C.jpg': api({ artist: 'Photo 32' }), 'File:D.jpg': api({ artist: null }) });
    const { mem, p } = go({ [CAND]: JSON.stringify([cand({ title: 'File:A.jpg' }), cand({ title: 'File:B.jpg' }), cand({ title: 'File:C.jpg' }), cand({ title: 'File:D.jpg', author: 'Іван Петренко' })]) }, f);
    const r = await p;
    expect(r.rejected).toHaveLength(3);
    expect(r.rejected[0].reason).toMatch(/файл не знайдено/);
    expect(r.rejected[1].reason).toMatch(/не вказано автора/);
    expect(r.rejected[2].reason).toMatch(/підказує відповідь/);
    expect(r.added).toEqual(['File:D.jpg']);
    expect(manifestOf(mem)[0].author).toBe('Іван Петренко');
  });
  it('вміст не відповідає типу (PNG під видом JPEG) — відхиляється, файл не записується', async () => {
    const f = fakeFetch({ 'File:TEST_FIXTURE.jpg': api() }, { [IMG]: bytes(PNG) });
    const { mem, p } = go({ [CAND]: JSON.stringify([cand()]) }, f);
    expect((await p).rejected[0].reason).toMatch(/не відповідає/);
    expect(mem.keys()).toEqual([CAND]);
  });
  it('помилки мережі й HTTP: API 404, зображення 404, виняток fetch', async () => {
    const noImage = fakeFetch({ 'File:TEST_FIXTURE.jpg': api() }, {});
    expect((await go({ [CAND]: JSON.stringify([cand()]) }, noImage).p).rejected[0].reason).toMatch(/завантаження: 404/);
    const noApi = fakeFetch({});
    expect((await go({ [CAND]: JSON.stringify([cand()]) }, noApi).p).rejected[0].reason).toMatch(/API відповіло 404/);
    const mem = memFs({ [CAND]: JSON.stringify([cand()]) });
    const boom = await run({ env: { COMMONS_CONTACT: 'x' }, root: ROOT, fetchImpl: async () => { throw new Error('ECONNRESET'); }, fs: mem.fs, log: () => undefined, now: NOW, delayMs: 0 });
    expect(boom.rejected[0].reason).toMatch(/помилка мережі: ECONNRESET/);
  });
  it('некоректні кандидати: зразок REPLACE_ME, без verifiedBy, code не ціле, title без «File:»', async () => {
    const f = fakeFetch({});
    const { p } = go({ [CAND]: JSON.stringify([cand({ title: 'File:REPLACE_ME.jpg' }), cand({ verifiedBy: '' }), cand({ code: '32' }), cand({ title: 'Wheat.jpg' }), 7]) }, f);
    const r = await p;
    expect(r.rejected).toHaveLength(5);
    expect(r.rejected[0].reason).toMatch(/зразок/);
    expect(r.rejected[1].reason).toMatch(/verifiedBy/);
    expect(r.rejected[2].reason).toMatch(/code/);
    expect(r.rejected[3].reason).toMatch(/File:/);
    expect(f.calls).toHaveLength(0);
  });
  it('повторний запуск нічого не качає наново; --refresh качає', async () => {
    const f = fakeFetch({ 'File:TEST_FIXTURE.jpg': api() });
    const first = go({ [CAND]: JSON.stringify([cand()]) }, f);
    await first.p;
    const files = Object.fromEntries([...first.mem.m.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    const f2 = fakeFetch({ 'File:TEST_FIXTURE.jpg': api() });
    const second = go(files, f2);
    expect((await second.p).skipped).toEqual(['File:TEST_FIXTURE.jpg']);
    expect(f2.calls).toHaveLength(0);
    const f3 = fakeFetch({ 'File:TEST_FIXTURE.jpg': api() });
    expect((await go(files, f3, ['--refresh']).p).added).toHaveLength(1);
    expect(f3.calls).toHaveLength(2);
  });
  it('існуючий маніфест зберігається; записи відсортовані за культурою й кодом; хибні кандидати поруч із добрими не заважають', async () => {
    const old = { id: 'winter-wheat-65-ff00aa', crop: 'winter-wheat', code: 65, source: DESC, author: 'Old', license: 'CC0', attribution: 'Old, CC0', file: 'p-ffffffffffff.png', checked: '2026-10-01', verifiedBy: 'source' };
    const f = fakeFetch({ 'File:TEST_FIXTURE.jpg': api(), 'File:BAD.jpg': api({ license: 'GFDL' }) });
    const { mem, p } = go({ [CAND]: JSON.stringify([cand(), cand({ title: 'File:BAD.jpg' })]), [MAN]: JSON.stringify([old]) }, f);
    const r = await p;
    expect(r.added).toHaveLength(1);
    expect(r.rejected).toHaveLength(1);
    expect(manifestOf(mem).map((x: { code: number }) => x.code)).toEqual([32, 65]);
  });
  it('--candidates і --contact з командного рядка', async () => {
    const f = fakeFetch({ 'File:TEST_FIXTURE.jpg': api() });
    const { p } = go({ [`${ROOT}/my.json`]: JSON.stringify([cand()]) }, f, ['--candidates', 'my.json', '--contact', 'me@example.org'], {});
    expect((await p).added).toHaveLength(1);
    expect(f.calls[0].ua).toContain('me@example.org');
  });
});
