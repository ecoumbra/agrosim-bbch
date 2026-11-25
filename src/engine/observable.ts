import { plantModel, visibleTillers } from './plantModel';
import { showsStemSection } from './timeline';

const q = (x: number, step: number): number => Math.round(x / step);

/** Що показує розріз стебла для фази: число вузлів (до 3) і стан зачатка колоса (точка росту / зачаток / вище кадру). */
export function sectionSignature(code: number): string {
  const m = plantModel(code);
  return JSON.stringify([Math.min(3, m.nodes), m.code < 30 ? 'veg' : m.code <= 33 ? 'prim' : 'up']);
}

/**
 * «Відбиток» того, що на малюнку (SVG-рослина і, для 29–49, розріз стебла) справді можна розрізнити.
 * Дві фази з однаковим відбитком на малюнку не відрізнити, тому їх не можна ставити варіантами одного питання.
 * Кроки округлення консервативні: дрібні відмінності (кілька пікселів) за помітні не вважаються.
 * section — чи показано в питанні розріз стебла (за замовчуванням: лише для 29–49, як на лінії розвитку).
 */
export function observableKey(code: number, section: boolean = showsStemSection(code)): string {
  const m = plantModel(code);
  const bulge = m.head > 0 ? 0.9 * (1 - m.head) : m.boot;
  const cut = section ? sectionSignature(code) : '';
  return JSON.stringify([
    q(m.imbibition, 0.5), q(m.radicle, 0.25), q(m.coleoptile, 0.35), q(m.roots, 0.2),
    m.code >= 30 ? -1 : Math.ceil(Math.max(m.leaves, m.leafGrow * 0.5) - 1e-6),
    Math.ceil(visibleTillers(m) - 1e-6),
    q(m.stem, 0.1), m.flagLeaf, q(bulge, 0.5), m.sheathOpen, q(m.head, 0.2), m.awns,
    q(m.anthers, 0.35), m.dryAnthers, q(m.grain, 0.25), q(m.ripe, 0.25), q(m.senescence, 0.25), q(m.shedding, 0.35),
    m.lodged, m.harvested, cut,
  ]);
}

/** Чи можна відрізнити дві фази на малюнку (з розрізом стебла або без нього). */
export const distinguishable = (a: number, b: number, section: boolean): boolean => observableKey(a, section) !== observableKey(b, section);
