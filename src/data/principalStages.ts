import type { PrincipalStage } from '../types';

/** Головні стадії розвитку загальної шкали BBCH (0–9). Українські назви — авторський переклад (див. ref-ua-terms). */
export const principalStages: PrincipalStage[] = [
  { id: 0, name: { en: 'Germination / sprouting / bud development', uk: 'Проростання насіння / розвиток бруньок' } },
  { id: 1, name: { en: 'Leaf development (main shoot)', uk: 'Розвиток листків (головний пагін)' } },
  { id: 2, name: { en: 'Formation of side shoots / tillering', uk: 'Утворення бічних пагонів / кущіння' } },
  { id: 3, name: { en: 'Stem elongation or rosette growth / shoot development', uk: 'Видовження стебла (вихід у трубку) або ріст розетки' } },
  { id: 4, name: { en: 'Development of harvestable vegetative parts / booting', uk: 'Розвиток товарних вегетативних органів / «черевце» (злаки)' } },
  { id: 5, name: { en: 'Inflorescence emergence / heading', uk: 'Поява суцвіття / колосіння' } },
  { id: 6, name: { en: 'Flowering', uk: 'Цвітіння' } },
  { id: 7, name: { en: 'Development of fruit', uk: 'Розвиток плодів (злаки: молочна стиглість)' } },
  { id: 8, name: { en: 'Ripening of fruit and seed', uk: 'Дозрівання плодів і насіння (злаки: тістоподібна стадія)' } },
  { id: 9, name: { en: 'Senescence, beginning of dormancy', uk: 'Старіння, початок спокою' } },
];
