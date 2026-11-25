import type { CSSProperties, ReactElement } from 'react';
import { plantModel, type PlantModel } from '../engine/plantModel';
import { getDict } from '../i18n';
import type { Lang } from '../types';

/**
 * Поздовжній розріз основи стебла пшениці: вузол кущіння, вузли 1–3, зачаток колоса.
 * З шкали BBCH (зернові) беруться лише мінімальні відстані: зачаток колоса ≥ 1 см над вузлом кущіння (30),
 * вузол 1 ≥ 1 см над вузлом кущіння (31), вузол 2 ≥ 2 см над вузлом 1 (32), вузол 3 ≥ 2 см над вузлом 2 (33).
 * Усе інше (форма, положення точки росту й зачатка між стадіями) — схематичне, авторське, і так підписане.
 */
const W = 360, H = 410, BASE = 330, PX = 34, XC = 180, TOP = 40;
/** Кумулятивні мінімуми від вузла кущіння [1, 3, 5] — похідні від кроків зі шкали (1, 2, 2). */
export const NODE_CM = plantModel(33).nodeMinCm;
const yOf = (cm: number): number => BASE - cm * PX;
const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k]));
const move = (y: number, visible: boolean, x = 0): CSSProperties => ({ transform: `translate(${x}px, ${y}px)`, opacity: visible ? 1 : 0, transition: 'transform .5s ease, opacity .4s ease' });
const fade = (visible: boolean): CSSProperties => ({ opacity: visible ? 1 : 0, transition: 'opacity .4s ease' });

/** Підпис у кілька рядків: символ «|» — перенесення. */
function label(x: number, y: number, text: string, extra?: { muted?: boolean; anchor?: 'start' | 'end' | 'middle'; size?: number }): ReactElement {
  const lines = text.split('|');
  return (
    <text x={x} y={y - ((lines.length - 1) * 6.5)} fontSize={extra?.size ?? 12} textAnchor={extra?.anchor ?? 'start'} fill={extra?.muted ? 'var(--mu)' : 'currentColor'} fontFamily="system-ui,sans-serif">
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 4 : 13}>{l}</tspan>)}
    </text>
  );
}

/** Рядки-пояснення під малюнком: тільки те, що є в шкалі, і позначені похідні значення. */
export function stemCaptionLines(m: PlantModel, lang: Lang): string[] {
  const d = getDict(lang);
  if (m.code < 30) return [d.stemCapVeg];
  if (m.code === 30) return [fill(d.stemCap30, { n: m.primordiumMinCm ?? 1 })];
  if (m.code > 33) return [d.stemCapAfter];
  return NODE_CM.slice(0, m.nodes).map((cum, k) => {
    const step = cum - (k > 0 ? NODE_CM[k - 1] : 0);
    return k === 0 ? fill(d.stemCapNode1, { n: step }) : fill(d.stemCapNodeN, { k: k + 1, n: step, p: k, sum: cum });
  });
}

export interface StemSectionProps {
  model: PlantModel; lang: Lang;
  /** Режим тренажера: без підписів-пояснень і без коду фази в описі, щоб не видавати відповідь. */
  quiz?: boolean;
}

export function StemSection({ model: m, lang, quiz = false }: StemSectionProps) {
  const d = getDict(lang);
  const cm = d.stemCm;
  const veg = m.code < 30;
  const prim = m.code >= 30 && m.code <= 33;
  const after = m.code > 33;
  const stepsShown = m.code >= 31 && m.code <= 33;
  const nn = Math.min(3, m.nodes);
  const primTipCm = m.code === 30 ? (m.primordiumMinCm ?? 1) : NODE_CM[Math.max(0, nn - 1)] + 1; // після 30 положення умовне
  const primH = 22 + 4 * Math.max(0, m.code - 30);
  const caption = stemCaptionLines(m, lang);
  const xs = [138, 150, 157, 203, 210];
  const crownPath = `M${XC - 52} ${BASE - 9}L${XC + 52} ${BASE - 9}L${XC + 44} ${BASE + 9}L${XC - 44} ${BASE + 9}Z`;
  const roots = [-38, -22, -8, 8, 22, 38].map((dx, i) => `M${XC + dx} ${BASE + 9}q${dx * 0.3} ${18 + (i % 3) * 6} ${dx * 0.6} ${40 + (i % 2) * 10}`);

  return (
    <figure className="stem-section">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={quiz ? d.stemAltQ : fill(d.stemAlt, { c: m.code })}>
        <rect width={W} height={H} fill="var(--stem-bg, #FBF9F1)" />
        {/* лінійка, см від вузла кущіння */}
        <g aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i}>
              <line x1={46} x2={338} y1={yOf(i)} y2={yOf(i)} stroke="var(--ln)" strokeWidth={0.6} opacity={0.7} />
              <line x1={40} x2={46} y1={yOf(i)} y2={yOf(i)} stroke="var(--mu)" strokeWidth={1} />
              <text x={34} y={yOf(i) + 3.5} fontSize={10} textAnchor="end" fill="var(--mu)" fontFamily="system-ui,sans-serif">{i}</text>
            </g>
          ))}
          <line x1={40} x2={40} y1={BASE} y2={yOf(8)} stroke="var(--mu)" strokeWidth={1} />
          {label(40, 22, cm, { muted: true, anchor: 'middle', size: 10 })}
        </g>
        {/* корені */}
        <g fill="none" stroke="#B49A6B" strokeWidth={1.4} strokeLinecap="round" aria-hidden="true">{roots.map((r, i) => <path key={i} d={r} />)}</g>
        {label(XC + 62, BASE + 52, d.stemRoots, { muted: true, size: 11 })}
        {/* стебло в розрізі: піхви (старші зовні) і порожнина міжвузля */}
        <defs>
          <linearGradient id="stemFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--stem-bg, #FBF9F1)', stopOpacity: 1 }} /><stop offset="1" style={{ stopColor: 'var(--stem-bg, #FBF9F1)', stopOpacity: 0 }} /></linearGradient>
          <linearGradient id="stemLumen" x1="0" x2="1"><stop offset="0" stopColor="#EADFC0" /><stop offset="0.5" stopColor="#F7F1DD" /><stop offset="1" stopColor="#EADFC0" /></linearGradient>
        </defs>
        <g stroke="#3F6F34" strokeWidth={0.6}>
          <rect x={xs[0]} y={TOP} width={12} height={BASE - TOP + 4} fill="#7DB561" />
          <rect x={xs[4]} y={TOP} width={12} height={BASE - TOP + 4} fill="#7DB561" />
          <rect x={xs[1]} y={TOP} width={7} height={BASE - TOP + 4} fill="#A6D183" />
          <rect x={xs[3]} y={TOP} width={7} height={BASE - TOP + 4} fill="#A6D183" />
        </g>
        <rect x={xs[2]} y={TOP} width={46} height={BASE - TOP} fill="url(#stemLumen)" />
        <g stroke="#CDBF93" strokeWidth={0.5} opacity={0.6} aria-hidden="true">{[166, 175, 185, 195].map((x) => <line key={x} x1={x} x2={x} y1={TOP} y2={BASE} />)}</g>
        {/* вузли 1–3: на мінімальних відстанях зі шкали */}
        {NODE_CM.map((cum, k) => (
          <g key={k} data-node={k + 1} data-visible={nn > k ? 'true' : 'false'} style={move(yOf(cum), nn > k)}>
            <rect x={xs[2]} y={-3.5} width={46} height={7} fill="#B79F5F" stroke="#8A743A" strokeWidth={0.6} />
            <ellipse cx={xs[0] + 1} cy={0} rx={4.5} ry={5.5} fill="#9BB07A" stroke="#3F6F34" strokeWidth={0.6} />
            <ellipse cx={xs[4] + 11} cy={0} rx={4.5} ry={5.5} fill="#9BB07A" stroke="#3F6F34" strokeWidth={0.6} />
            <line x1={XC + 42} x2={XC + 58} y1={0} y2={0} stroke="var(--mu)" strokeWidth={0.8} />
            {label(XC + 62, 0, `${d.stemNode} ${k + 1}`)}
          </g>
        ))}
        {/* скобки мінімальних відстаней (лише 30–33) */}
        <g aria-hidden="true">
          {NODE_CM.map((cum, k) => {
            const prev = k > 0 ? NODE_CM[k - 1] : 0, mid = (yOf(prev) + yOf(cum)) / 2;
            return (
              <g key={k} style={fade(stepsShown && nn > k)} stroke="var(--g)" strokeWidth={1.2} fill="none">
                <path d={`M118 ${yOf(prev)}L112 ${yOf(prev)}L112 ${yOf(cum)}L118 ${yOf(cum)}`} />
                {label(106, mid, `≥ ${cum - prev} ${cm}`, { anchor: 'end', size: 11 })}
              </g>
            );
          })}
          <g style={fade(m.code === 30)} stroke="var(--g)" strokeWidth={1.2} fill="none">
            <path d={`M118 ${BASE}L112 ${BASE}L112 ${yOf(1)}L118 ${yOf(1)}`} />
            {label(106, (BASE + yOf(1)) / 2, `≥ ${m.primordiumMinCm ?? 1} ${cm}`, { anchor: 'end', size: 11 })}
          </g>
        </g>
        {/* верх розрізу: стебло продовжується */}
        <path d={`M${xs[0]} ${TOP - 8}L${xs[0]} ${TOP}${Array.from({ length: 12 }, (_, i) => `L${xs[0] + 7 * (i + 1)} ${TOP - (i % 2 ? 0 : 6)}`).join('')}L${xs[4] + 12} ${TOP - 8}Z`} fill="var(--stem-bg, #FBF9F1)" />
        <rect x={xs[0] - 6} y={TOP - 8} width={96} height={52} fill="url(#stemFade)" aria-hidden="true" />
        {/* вузол кущіння */}
        <path d={crownPath} fill="#F1E9CC" stroke="#B9A66A" strokeWidth={0.9} />
        <path d={`M${XC - 54} ${BASE - 6}q-14 -4 -18 -22q14 2 22 14z`} fill="#86C06A" stroke="#3F6F34" strokeWidth={0.6} />
        <path d={`M${XC + 54} ${BASE - 6}q14 -4 18 -22q-14 2 -22 14z`} fill="#86C06A" stroke="#3F6F34" strokeWidth={0.6} />
        <line x1={XC + 52} x2={XC + 58} y1={BASE} y2={BASE} stroke="var(--mu)" strokeWidth={0.8} />
        {label(XC + 62, BASE, d.stemCrown)}
        {/* точка росту до 30 */}
        <g style={move(BASE - 12, veg, XC)} data-apex="vegetative" data-visible={veg ? 'true' : 'false'}>
          <path d="M-9 0Q-9 -16 0 -22Q9 -16 9 0Z" fill="#CFE8A8" stroke="#7FA85A" strokeWidth={0.8} />
          <path d="M-4 -2Q-3 -11 0 -15M4 -2Q3 -11 0 -15" fill="none" stroke="#7FA85A" strokeWidth={0.6} />
          <line x1={11} x2={58} y1={-12} y2={-12} stroke="var(--mu)" strokeWidth={0.8} />
          {label(62, -12, d.stemApex)}
        </g>
        {/* зачаток колоса 30–33 (після 30 положення умовне: пунктир) */}
        <g style={move(yOf(primTipCm), prim, XC)} data-apex="primordium" data-visible={prim ? 'true' : 'false'} data-schematic={m.code > 30 ? 'true' : 'false'}>
          <g strokeDasharray={m.code > 30 ? '3 2' : undefined}>
            <path d={`M0 0C9 6 11 ${primH * 0.6} 9 ${primH}L-9 ${primH}C-11 ${primH * 0.6} -9 6 0 0Z`} fill="#EDF3C9" stroke="#8DA55A" strokeWidth={1} />
          </g>
          {Array.from({ length: 5 }, (_, j) => (
            <g key={j} fill="#C9DC8A"><ellipse cx={-5} cy={8 + j * ((primH - 12) / 5)} rx={3} ry={1.8} /><ellipse cx={5} cy={8 + j * ((primH - 12) / 5)} rx={3} ry={1.8} /></g>
          ))}
          <line x1={11} x2={58} y1={primH / 2} y2={primH / 2} stroke="var(--mu)" strokeWidth={0.8} />
          {label(62, primH / 2, d.stemPrim)}
        </g>
        {/* після 33: зачаток вище за межами розрізу */}
        <g style={fade(after)} aria-hidden="true">
          <path d={`M${XC} 118L${XC} 62M${XC - 6} 70L${XC} 60L${XC + 6} 70`} fill="none" stroke="var(--g)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          {label(XC + 62, 92, m.growingPoint === 'ear' ? d.stemUpEar : d.stemUp)}
        </g>
      </svg>
      {!quiz && (
        <figcaption>
          <ul>{caption.map((t, i) => <li key={i}>{t}</li>)}</ul>
          <p className="stem-note">{d.stemNote}</p>
        </figcaption>
      )}
    </figure>
  );
}
