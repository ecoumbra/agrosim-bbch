import { describe, expect, it } from 'vitest';
import config from '../vite.config';
import manifest from '../src/data/photos.manifest.json';
import { PHOTOS } from '../src/data/photos';
import { crops } from '../src/data/crops';
import { photoCodes, photoUrl, pickPhoto, validateManifest, validatePhoto, validPhotos } from '../src/engine/photos';
import { makeRng } from '../src/engine/trainer';
import type { Photo } from '../src/types';

const TODAY = '2026-11-21';
const good: Photo = {
  id: 'winter-wheat-32-ab12cd', crop: 'winter-wheat', code: 32, source: 'https://commons.wikimedia.org/wiki/File:TEST_FIXTURE.jpg',
  author: 'Test Author', license: 'CC BY-SA 4.0', attribution: 'Test Author, CC BY-SA 4.0, Wikimedia Commons',
  file: 'p-0123456789ab.jpg', checked: '2026-11-01', verifiedBy: 'source',
};
const errs = (over: Record<string, unknown>) => validatePhoto({ ...good, ...over }, crops, TODAY);

describe('валідатор запису фото', () => {
  it('правильний запис не має помилок', () => { expect(validatePhoto(good, crops, TODAY)).toEqual([]); });
  it('кожне обов’язкове поле: порожнє або відсутнє — помилка', () => {
    for (const f of ['id', 'crop', 'source', 'author', 'license', 'attribution', 'file', 'checked', 'verifiedBy']) {
      expect(errs({ [f]: '' }).length, `${f}=""`).toBeGreaterThan(0);
      expect(errs({ [f]: '   ' }).length, `${f}="   "`).toBeGreaterThan(0);
      const copy: Record<string, unknown> = { ...good }; delete copy[f];
      expect(validatePhoto(copy, crops, TODAY).length, `без ${f}`).toBeGreaterThan(0);
    }
  });
  it('code: ціле число, що є в шкалі культури; 34 (немає у зернових) і кукурудза (шкали ще немає) — помилка', () => {
    expect(errs({ code: 34 }).join()).toMatch(/немає в шкалі/);
    expect(errs({ code: 32.5 }).join()).toMatch(/цілим/);
    expect(errs({ code: '32' }).join()).toMatch(/цілим/);
    expect(errs({ crop: 'maize' }).join()).toMatch(/немає в шкалі/);
    expect(errs({ crop: 'tomato' }).join()).toMatch(/невідома культура/);
  });
  it('ліцензія: NC, ND, GFDL, неканонічний запис — помилка; дозволені проходять', () => {
    for (const l of ['CC BY-NC 4.0', 'CC BY-ND 2.0', 'GFDL', 'All rights reserved', 'cc by 4.0', 'CC BY']) expect(errs({ license: l }).join(), l).toMatch(/ліцензія/);
    for (const l of ['CC0', 'CC BY 4.0', 'CC BY-SA 3.0', 'Public domain']) expect(errs({ license: l }), l).toEqual([]);
  });
  it('file нейтральний, id коректний, source — https, дата існуюча й не з майбутнього', () => {
    expect(errs({ file: 'wheat-bbch-32.jpg' }).join()).toMatch(/нейтральне/);
    expect(errs({ file: '../p-0123456789ab.jpg' }).join()).toMatch(/нейтральне/);
    expect(errs({ id: 'ID З ПРОБІЛАМИ' }).join()).toMatch(/id:/);
    expect(errs({ source: 'http://commons.wikimedia.org/wiki/File:X.jpg' }).join()).toMatch(/https/);
    expect(errs({ source: 'не посилання' }).join()).toMatch(/https/);
    expect(errs({ checked: '2026-02-30' }).join()).toMatch(/дат/);
    expect(errs({ checked: '2026-12-01' }).join()).toMatch(/майбутньому/);
    expect(errs({ checked: TODAY })).toEqual([]);
  });
  it('attribution не підказує відповідь: «BBCH» або двозначне число — помилка', () => {
    expect(errs({ attribution: 'BBCH 32, CC BY 4.0' }).join()).toMatch(/підказує/);
    expect(errs({ attribution: 'Photo 32, CC BY 4.0' }).join()).toMatch(/підказує/);
    expect(errs({ attribution: 'Автор 2019, CC BY 2.0' })).toEqual([]);
  });
  it('не-об’єкти відхиляються', () => {
    for (const bad of [null, 5, 'x', [], undefined]) expect(validatePhoto(bad, crops, TODAY)).toEqual(['запис не є об’єктом']);
  });
});

describe('маніфест', () => {
  const second: Photo = { ...good, id: 'winter-wheat-65-ff00aa', code: 65, file: 'p-ffffffffffff.png' };
  it('валідні записи без повторів проходять', () => { expect(validateManifest([good, second], crops, TODAY)).toEqual([]); });
  it('повтор id або file, не масив, номери записів у повідомленнях', () => {
    expect(validateManifest([good, { ...second, id: good.id }], crops, TODAY).join()).toMatch(/#2: id .* повторюється/);
    expect(validateManifest([good, { ...second, file: good.file }], crops, TODAY).join()).toMatch(/#2: file .* повторюється/);
    expect(validateManifest({}, crops, TODAY)).toEqual(['маніфест має бути масивом']);
    expect(validateManifest([good, { ...second, license: 'CC BY-NC 4.0' }], crops, TODAY)[0]).toMatch(/^#2: /);
  });
  it('validPhotos залишає лише правильні записи; при повторі перший виграє; сміття ігнорується', () => {
    const list = [good, { ...second, license: 'GFDL' }, { ...good, code: 34, id: 'winter-wheat-34-aaaaaa', file: 'p-aaaaaaaaaaaa.jpg' }, { ...good }, 5, null];
    expect(validPhotos(list, crops, TODAY)).toEqual([good]);
    expect(validPhotos('не масив', crops, TODAY)).toEqual([]);
  });
  it('СПРАВЖНІЙ маніфест проєкту проходить перевірку (запускається в npm test, тож хибний запис не потрапить у збірку)', () => {
    expect(validateManifest(manifest, crops, new Date().toISOString().slice(0, 10))).toEqual([]);
    expect(PHOTOS).toHaveLength((manifest as unknown[]).length);
  });
});

describe('вибір фото й URL', () => {
  const a: Photo = { ...good, id: 'winter-wheat-32-aaaaaa', file: 'p-aaaaaaaaaaaa.jpg' };
  const b: Photo = { ...good, id: 'winter-wheat-32-bbbbbb', file: 'p-bbbbbbbbbbbb.jpg' };
  const c: Photo = { ...good, id: 'winter-wheat-13-cccccc', code: 13, file: 'p-cccccccccccc.jpg' };
  it('photoCodes: унікальні відсортовані коди лише потрібної культури', () => {
    expect(photoCodes([a, b, c, { ...c, crop: 'maize', code: 99 }], 'winter-wheat')).toEqual([13, 32]);
    expect(photoCodes([], 'winter-wheat')).toEqual([]);
  });
  it('pickPhoto: фото потрібної фази, детерміновано за rng, обидва фото трапляються; немає фото — undefined', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) { const p = pickPhoto([a, b, c], 'winter-wheat', 32, makeRng(s))!; expect(p.code).toBe(32); seen.add(p.id); }
    expect(seen.size).toBe(2);
    expect(pickPhoto([a, b, c], 'winter-wheat', 32, makeRng(5))).toEqual(pickPhoto([a, b, c], 'winter-wheat', 32, makeRng(5)));
    expect(pickPhoto([a, b, c], 'winter-wheat', 99, makeRng(1))).toBeUndefined();
  });
  it('photoUrl коректно з’єднує base застосунку', () => {
    expect(photoUrl('p-0123456789ab.jpg', './')).toBe('./photos/p-0123456789ab.jpg');
    expect(photoUrl('p-0123456789ab.jpg', '/')).toBe('/photos/p-0123456789ab.jpg');
    expect(photoUrl('p-0123456789ab.jpg', '/agrosim')).toBe('/agrosim/photos/p-0123456789ab.jpg');
    expect(photoUrl('p-0123456789ab.jpg', '/agrosim/')).toBe('/agrosim/photos/p-0123456789ab.jpg');
  });
});

describe('конфігурація тестів', () => {
  it('Vitest запускає і .test.tsx (інакше тести компонентів мовчки не виконувались би)', () => {
    expect(config.test?.include).toContain('tests/**/*.test.{ts,tsx}');
  });
});
