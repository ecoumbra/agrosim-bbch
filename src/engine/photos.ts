import type { Crop, Photo } from '../types';
import { FILE_RE, ID_RE, hasCodeLeak, isAllowedLicense, isIsoDate } from './photoRules.mjs';
import type { Rng } from './trainer';

const FIELDS = ['id', 'crop', 'source', 'author', 'license', 'attribution', 'file', 'checked', 'verifiedBy'] as const;
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isHttps = (v: string): boolean => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };

/** Помилки одного запису маніфесту (порожній список — запис правильний). today — YYYY-MM-DD, «сьогодні». */
export function validatePhoto(p: unknown, crops: Crop[], today: string): string[] {
  if (typeof p !== 'object' || p === null || Array.isArray(p)) return ['запис не є об’єктом'];
  const r = p as Record<string, unknown>;
  const errors: string[] = [];
  for (const f of FIELDS) if (!nonEmpty(r[f])) errors.push(`поле ${f} порожнє або відсутнє`);
  if (typeof r.code !== 'number' || !Number.isInteger(r.code)) errors.push('поле code має бути цілим числом');
  if (errors.length) return errors;
  const s = r as unknown as Photo;
  if (!ID_RE.test(s.id)) errors.push('id: лише a-z, 0-9 і «-», 3–80 символів');
  const crop = crops.find((c) => c.id === s.crop);
  if (!crop) errors.push(`невідома культура «${s.crop}»`);
  else if (!crop.stages.some((x) => x.code === s.code)) errors.push(`коду ${s.code} немає в шкалі культури «${s.crop}»`);
  if (!isHttps(s.source)) errors.push('source має бути https-посиланням на сторінку файлу');
  if (!isAllowedLicense(s.license)) errors.push(`ліцензія «${s.license}» не дозволена (лише CC0, CC BY, CC BY-SA, Public domain у канонічному записі)`);
  if (!FILE_RE.test(s.file)) errors.push('file: очікується нейтральне ім’я виду p-<hex>.jpg|png|webp');
  if (!isIsoDate(s.checked)) errors.push('checked: очікується існуюча дата YYYY-MM-DD');
  else if (s.checked > today) errors.push('checked: дата в майбутньому');
  if (hasCodeLeak(s.attribution)) errors.push('attribution містить «BBCH» або двозначне число: це підказує відповідь');
  return errors;
}

/** Помилки всього маніфесту, з номерами записів; перевіряє також унікальність id і file. */
export function validateManifest(list: unknown, crops: Crop[], today: string): string[] {
  if (!Array.isArray(list)) return ['маніфест має бути масивом'];
  const errors: string[] = [];
  const ids = new Set<string>(), files = new Set<string>();
  list.forEach((p, i) => {
    for (const e of validatePhoto(p, crops, today)) errors.push(`#${i + 1}: ${e}`);
    const r = (typeof p === 'object' && p !== null ? p : {}) as Record<string, unknown>;
    if (typeof r.id === 'string') { if (ids.has(r.id)) errors.push(`#${i + 1}: id «${r.id}» повторюється`); ids.add(r.id); }
    if (typeof r.file === 'string') { if (files.has(r.file)) errors.push(`#${i + 1}: file «${r.file}» повторюється`); files.add(r.file); }
  });
  return errors;
}

/** Лише ті записи, що проходять перевірку; хибні запис ігноруються, щоб не ламати тренажер. */
export function validPhotos(list: unknown, crops: Crop[], today: string): Photo[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list.filter((p) => {
    if (validatePhoto(p, crops, today).length) return false;
    const x = p as Photo;
    if (seen.has(x.id) || seen.has(`file:${x.file}`)) return false;
    seen.add(x.id); seen.add(`file:${x.file}`);
    return true;
  }) as Photo[];
}

/** Коди фаз культури, для яких є хоча б одне фото. */
export const photoCodes = (photos: Photo[], cropId: string): number[] =>
  [...new Set(photos.filter((p) => p.crop === cropId).map((p) => p.code))].sort((a, b) => a - b);

/** Одне з фото фази (детерміновано за rng). */
export function pickPhoto(photos: Photo[], cropId: string, code: number, rng: Rng): Photo | undefined {
  const list = photos.filter((p) => p.crop === cropId && p.code === code);
  return list.length ? list[Math.floor(rng() * list.length)] : undefined;
}

/** URL файлу з урахуванням base застосунку (у Vite base = './'). */
export const photoUrl = (file: string, base: string): string => `${base.endsWith('/') ? base : `${base}/`}photos/${file}`;
