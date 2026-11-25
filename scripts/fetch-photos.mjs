#!/usr/bin/env node
/**
 * Завантаження фото з Wikimedia Commons у public/photos/ і поповнення src/data/photos.manifest.json.
 *
 *   COMMONS_CONTACT="ваша@пошта" npm run photos -- --dry-run     # лише перевірка ліцензій, без запису
 *   COMMONS_CONTACT="ваша@пошта" npm run photos                  # завантаження
 *
 * Вхід: scripts/photos.candidates.json (зразок: photos.candidates.example.json) — масив
 *   { "crop": "winter-wheat", "code": 32, "title": "File:Назва файлу.jpg", "verifiedBy": "ПІБ викладача або source", "author": "(необов'язково)" }
 * Код BBCH скрипт НЕ визначає: його підтверджує експерт (або він указаний в описі джерела) — у полі verifiedBy.
 * Ліцензія береться з API Commons і має бути CC0, CC BY, CC BY-SA або Public domain; решта відхиляється.
 * Потрібен Node 18+ (глобальний fetch). Файли отримують нейтральні імена p-<хеш>.<ext>.
 */
import { createHash } from 'node:crypto';
import { mkdir as fsMkdir, readFile as fsReadFile, writeFile as fsWriteFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hasCodeLeak, isCommonsImageHost, normalizeLicense, stripHtml } from '../src/engine/photoRules.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 15 * 1024 * 1024;

const fail = (reason) => ({ ok: false, reason });

/** Розбір відповіді API Commons (prop=imageinfo, formatversion=2). Чиста функція. */
export function parseImageInfo(json, opts = {}) {
  const pages = json && json.query && json.query.pages;
  const page = Array.isArray(pages) ? pages[0] : undefined;
  if (!page || page.missing) return fail('файл не знайдено на Commons');
  const ii = Array.isArray(page.imageinfo) ? page.imageinfo[0] : undefined;
  if (!ii) return fail('API не повернуло imageinfo');
  const meta = ii.extmetadata || {};
  const val = (k) => (meta[k] && typeof meta[k].value === 'string' ? meta[k].value : '');
  const licenseRaw = stripHtml(val('LicenseShortName'));
  const license = normalizeLicense(licenseRaw);
  if (!license) return fail(`ліцензія «${licenseRaw || 'не вказана'}» не дозволена (лише CC0, CC BY, CC BY-SA, Public domain)`);
  const ext = MIME_EXT[ii.mime];
  if (!ext) return fail(`непідтримуваний тип файлу «${ii.mime}»`);
  const author = (opts.authorOverride && String(opts.authorOverride).trim()) || stripHtml(val('Artist'));
  if (!author) return fail('на Commons не вказано автора (Artist): додайте поле author у кандидата');
  const descriptionUrl = ii.descriptionurl;
  if (typeof descriptionUrl !== 'string' || !descriptionUrl.startsWith('https://commons.wikimedia.org/wiki/File:')) return fail('сторінка файлу не з commons.wikimedia.org');
  const imageUrl = ii.thumburl || ii.url;
  if (!isCommonsImageHost(imageUrl)) return fail('URL зображення не з upload.wikimedia.org');
  return { ok: true, info: { descriptionUrl, imageUrl, ext, mime: ii.mime, license, licenseRaw, author } };
}

const sha1 = (s) => createHash('sha1').update(s).digest('hex');
/** Нейтральне ім'я файлу: не містить ні коду фази, ні назви. */
export const fileNameFor = (title, ext) => `p-${sha1(title).slice(0, 12)}.${ext}`;
export const makeId = (crop, code, title) => `${crop}-${code}-${sha1(title).slice(0, 6)}`;

function magicOk(buf, mime) {
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG';
  if (mime === 'image/webp') return buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP';
  return false;
}

function parseArgs(argv) {
  const o = { dryRun: false, refresh: false, candidates: undefined, contact: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') o.dryRun = true;
    else if (argv[i] === '--refresh') o.refresh = true;
    else if (argv[i] === '--candidates') o.candidates = argv[++i];
    else if (argv[i] === '--contact') o.contact = argv[++i];
  }
  return o;
}

function checkCandidate(c) {
  if (typeof c !== 'object' || c === null) return 'запис не є об’єктом';
  if (typeof c.crop !== 'string' || !c.crop) return 'не вказано crop';
  if (!Number.isInteger(c.code)) return 'code має бути цілим числом';
  if (typeof c.title !== 'string' || !c.title.startsWith('File:')) return 'title має починатися з «File:»';
  if (/REPLACE_ME/i.test(c.title)) return 'title — це зразок: підставте реальну назву файлу';
  if (typeof c.verifiedBy !== 'string' || !c.verifiedBy.trim()) return 'verifiedBy обов’язковий: хто підтвердив код BBCH (експерт) або «source»';
  return null;
}

/**
 * Головна функція. Залежності підставляються (fetchImpl, fs, log, now), тому її можна перевірити без мережі.
 * Повертає { added, skipped, rejected }.
 */
export async function run({ argv = [], env = {}, root, fetchImpl = globalThis.fetch, fs = { readFile: fsReadFile, writeFile: fsWriteFile, mkdir: fsMkdir }, log = console.log, now = () => new Date(), delayMs = 400 } = {}) {
  const { readFile, writeFile, mkdir } = fs;
  const args = parseArgs(argv);
  const contact = args.contact || env.COMMONS_CONTACT;
  if (!contact) throw new Error('Вкажіть контакт для User-Agent (політика Wikimedia): COMMONS_CONTACT=ваша@пошта або --contact.');
  if (typeof fetchImpl !== 'function') throw new Error('Потрібен Node 18+ (глобальний fetch).');
  const ua = `AgroSimBBCH/1.0 (${contact}) fetch-photos`;
  const candPath = path.resolve(root, args.candidates || 'scripts/photos.candidates.json');
  const manifestPath = path.join(root, 'src/data/photos.manifest.json');
  const photosDir = path.join(root, 'public/photos');
  const today = now().toISOString().slice(0, 10);

  const candidates = JSON.parse(await readFile(candPath, 'utf-8'));
  if (!Array.isArray(candidates)) throw new Error('Файл кандидатів має бути масивом.');
  let manifest = [];
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf-8')); } catch { manifest = []; }
  if (!Array.isArray(manifest)) throw new Error('photos.manifest.json має бути масивом.');

  const result = { added: [], skipped: [], rejected: [] };
  for (const c of candidates) {
    const label = c && c.title ? String(c.title) : '(без title)';
    const bad = checkCandidate(c);
    if (bad) { result.rejected.push({ title: label, reason: bad }); continue; }
    const id = makeId(c.crop, c.code, c.title);
    if (!args.refresh && manifest.some((m) => m.id === id)) { result.skipped.push(label); continue; }

    const url = new URL(API);
    for (const [k, v] of Object.entries({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata', iiurlwidth: '1200', titles: c.title })) url.searchParams.set(k, v);
    let res;
    try { res = await fetchImpl(url.toString(), { headers: { 'User-Agent': ua, Accept: 'application/json' } }); } catch (e) { result.rejected.push({ title: label, reason: `помилка мережі: ${e.message}` }); continue; }
    if (!res.ok) { result.rejected.push({ title: label, reason: `API відповіло ${res.status}` }); continue; }
    const parsed = parseImageInfo(await res.json(), { authorOverride: c.author });
    if (!parsed.ok) { result.rejected.push({ title: label, reason: parsed.reason }); continue; }
    const { info } = parsed;
    const attribution = `${info.author}, ${info.license}, Wikimedia Commons`;
    if (hasCodeLeak(attribution)) { result.rejected.push({ title: label, reason: 'підпис автора містить «BBCH» або двозначне число (підказує відповідь): задайте author у кандидата' }); continue; }
    const file = fileNameFor(c.title, info.ext);

    if (!args.dryRun) {
      let img;
      try { img = await fetchImpl(info.imageUrl, { headers: { 'User-Agent': ua } }); } catch (e) { result.rejected.push({ title: label, reason: `помилка завантаження: ${e.message}` }); continue; }
      if (!img.ok) { result.rejected.push({ title: label, reason: `завантаження: ${img.status}` }); continue; }
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_BYTES) { result.rejected.push({ title: label, reason: `розмір файлу ${buf.length} байт поза допустимим` }); continue; }
      if (!magicOk(buf, info.mime)) { result.rejected.push({ title: label, reason: 'вміст файлу не відповідає заявленому типу' }); continue; }
      await mkdir(photosDir, { recursive: true });
      await writeFile(path.join(photosDir, file), buf);
    }
    const entry = { id, crop: c.crop, code: c.code, source: info.descriptionUrl, author: info.author, license: info.license, attribution, file, checked: today, verifiedBy: c.verifiedBy.trim() };
    manifest = [...manifest.filter((m) => m.id !== id), entry];
    result.added.push(label);
    log(`${args.dryRun ? '[dry-run] ' : ''}OK  ${label} → ${info.license}, ${info.author}`);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  if (!args.dryRun && result.added.length > 0) {
    manifest.sort((a, b) => a.crop.localeCompare(b.crop) || a.code - b.code || a.id.localeCompare(b.id));
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  }
  for (const r of result.rejected) log(`ВІДХИЛЕНО  ${r.title}: ${r.reason}`);
  log(`Додано: ${result.added.length}, пропущено (вже є): ${result.skipped.length}, відхилено: ${result.rejected.length}.`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  run({ argv: process.argv.slice(2), env: process.env, root })
    .then((r) => { process.exitCode = r.rejected.length ? 1 : 0; })
    .catch((e) => { console.error(e.message); process.exitCode = 1; });
}
