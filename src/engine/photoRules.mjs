/**
 * Правила фото з відкритих джерел (docs/PHOTOS.md). Спільні для застосунку і скрипта завантаження,
 * тому це звичайний ES-модуль без залежностей: політика ліцензій має бути в одному місці.
 */

/**
 * Приводить назву ліцензії (як її повертає Commons) до дозволеної канонічної форми
 * («CC0», «CC BY 4.0», «CC BY-SA 3.0», «Public domain») або повертає null, якщо ліцензія не дозволена
 * (NC, ND, GFDL, «усі права захищені», невідома тощо).
 */
export function normalizeLicense(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  const tail = '(?: International| Generic| Unported| Universal)?';
  if (new RegExp(`^CC0(?: 1\\.0)?${tail}$`, 'i').test(s)) return 'CC0';
  const sa = new RegExp(`^CC[ -]BY[ -]SA[ -](\\d\\.\\d)${tail}$`, 'i').exec(s);
  if (sa) return `CC BY-SA ${sa[1]}`;
  const by = new RegExp(`^CC[ -]BY[ -](\\d\\.\\d)${tail}$`, 'i').exec(s);
  if (by) return `CC BY ${by[1]}`;
  if (/^public domain$/i.test(s) || /^PD(?:[- ][A-Za-z0-9-]+)*$/.test(s)) return 'Public domain';
  return null;
}

/** Ліцензія в маніфесті має бути вже в канонічній дозволеній формі. */
export const isAllowedLicense = (s) => typeof s === 'string' && normalizeLicense(s) === s;

/** Прибирає HTML із поля Commons (Artist тощо) і розкодовує прості сутності. */
export function stripHtml(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Нейтральне ім'я файлу: за ним у DevTools не можна здогадатися про фазу. */
export const FILE_RE = /^p-[0-9a-f]{8,40}\.(?:jpg|png|webp)$/;
export const ID_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;

/** Дата YYYY-MM-DD, що існує в календарі. */
export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Підпис, який видно до відповіді, не повинен містити код фази: «BBCH» або двозначне число. */
export const hasCodeLeak = (text) => /BBCH|\b\d{2}\b/i.test(String(text));

/** Чи дозволений хост для завантаження зображень. */
export const isCommonsImageHost = (url) => {
  try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'upload.wikimedia.org'; } catch { return false; }
};
