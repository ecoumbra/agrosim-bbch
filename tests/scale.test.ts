import { describe, expect, it } from 'vitest';
import { crops } from '../src/data/crops';
import { references } from '../src/data/references';
import { principalStages } from '../src/data/principalStages';
import { cerealStages } from '../src/data/scales/cereals';
import { nearestStage, searchStages, stageByCode, stagesOfPrincipal, validateCrop } from '../src/engine/scale';

const wheat = crops.find((c) => c.id === 'winter-wheat')!;
const refIds = references.map((r) => r.id);

describe('шкала BBCH для зернових', () => {
  it('цілісна: коди зростають, головні стадії збігаються, тексти й джерела є', () => {
    expect(validateCrop(wheat, refIds)).toEqual([]);
  });
  it('містить ключові коди з монографії та звірених джерел', () => {
    const expected = [0, 9, 10, 11, 13, 19, 21, 29, 30, 31, 32, 33, 37, 39, 41, 43, 45, 47, 49, 51, 52, 55, 58, 59, 61, 65, 69, 71, 73, 75, 77, 83, 85, 87, 89, 92, 93, 97, 99];
    for (const c of expected) expect(stageByCode(wheat, c), `код ${c}`).toBeDefined();
  });
  it('не містить кодів, яких немає в шкалі зернових (наприклад 20, 91)', () => {
    for (const c of [20, 34, 35, 36, 44, 91]) expect(stageByCode(wheat, c)).toBeUndefined();
  });
  it('усі десять головних стадій представлені', () => {
    expect(principalStages.map((p) => p.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const p of principalStages) expect(stagesOfPrincipal(wheat, p.id).length).toBeGreaterThan(0);
  });
  it('критичні визначення відповідають монографії', () => {
    expect(stageByCode(wheat, 31)!.description.en).toContain('1 cm');
    expect(stageByCode(wheat, 32)!.description.en).toContain('2 cm above node 1');
    expect(stageByCode(wheat, 85)!.description.en).toContain('not held');
    expect(stageByCode(wheat, 87)!.description.en).toContain('impression held');
    expect(stageByCode(wheat, 39)!.description.en).toContain('ligule');
    expect(stageByCode(wheat, 65)!.description.en).toContain('50 %');
    expect(stageByCode(wheat, 55)!.description.uk).toContain('половина');
  });
  it('листки 11–19 і пагони кущіння 21–29 повні', () => {
    for (let c = 11; c <= 19; c++) expect(stageByCode(wheat, c)).toBeDefined();
    for (let c = 21; c <= 29; c++) expect(stageByCode(wheat, c)).toBeDefined();
    for (let c = 51; c <= 59; c++) expect(stageByCode(wheat, c)).toBeDefined();
  });
  it('фази з методичним текстом мають сусідів для порівняння', () => {
    for (const s of cerealStages.filter((x) => x.code >= 30 && x.howToCheck)) {
      expect(s.confusableWith!.length).toBeGreaterThan(0);
      for (const n of s.confusableWith!) expect(Math.abs(n - s.code)).toBeLessThan(40);
    }
  });
  it('пошук і найближча фаза', () => {
    expect(searchStages(wheat, '37', 'uk')[0].code).toBe(37);
    expect(searchStages(wheat, 'прапорцев', 'uk').length).toBeGreaterThan(1);
    expect(searchStages(wheat, '34', 'uk')).toEqual([]);
    expect(nearestStage(wheat, 34)!.code).toBe(33);
    expect(searchStages(wheat, 'ligule', 'en').length).toBeGreaterThan(0);
  });
});

describe('культури й джерела', () => {
  it('доступні культури мають стадії; решта — заплановані', () => {
    for (const c of crops) expect(c.available ? c.stages.length > 0 : c.stages.length === 0).toBe(true);
    expect(crops.map((c) => c.id)).toEqual(['winter-wheat', 'maize', 'sunflower', 'rapeseed', 'sugar-beet']);
  });
  it('перше джерело — монографія BBCH із DOI і ліцензією', () => {
    const r = references.find((x) => x.id === 'ref-bbch')!;
    expect(r.status).toBe('primary');
    expect(r.citation).toContain('10.5073/20180906-074619');
    expect(r.license).toBe('CC BY 4.0');
  });
});
