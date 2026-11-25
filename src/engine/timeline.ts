import type { Crop, Stage } from '../types';
import { principalStages } from '../data/principalStages';
import { SEASON_ORDER, seasonOf, type Season } from './plantModel';
import { nearestStage } from './scale';

/** Ключові фази для швидких переходів; показуються лише ті, що є в шкалі культури. */
export const KEY_CODES = [0, 9, 13, 21, 30, 32, 39, 45, 51, 59, 65, 75, 89, 99] as const;
export const keyStages = (c: Crop): Stage[] => KEY_CODES.map((k) => c.stages.find((s) => s.code === k)).filter((s): s is Stage => s !== undefined);

/** Індекс стадії в шкалі культури; код, якого в шкалі немає, замінюється найближчою наявною стадією. */
export function indexOfCode(c: Crop, code: number): number {
  const n = nearestStage(c, code);
  return n ? c.stages.indexOf(n) : 0;
}

export type SeasonState = 'active' | 'between' | 'off';
/** Стан кожного сезону для коду; «зима» — проміжна, коли фаза охоплює і осінь, і весну. */
export function seasonStrip(code: number): { season: Season; state: SeasonState }[] {
  const act = seasonOf(code);
  const between = act.includes('autumn') && act.includes('spring');
  return SEASON_ORDER.map((season) => ({ season, state: act.includes(season) ? 'active' : season === 'winter' && between ? 'between' : 'off' }));
}

/** Головні стадії, що мають фази в шкалі, з кількістю фаз (для смуги під слайдером). */
export function principalSegments(c: Crop): { id: number; count: number; firstCode: number }[] {
  return principalStages
    .map((p) => { const list = c.stages.filter((s) => s.principal === p.id); return { id: p.id, count: list.length, firstCode: list[0]?.code ?? -1 }; })
    .filter((x) => x.count > 0);
}

/** Розріз стебла має сенс там, де працюють вузли й зачаток колоса. */
export const showsStemSection = (code: number): boolean => code >= 29 && code <= 49;
