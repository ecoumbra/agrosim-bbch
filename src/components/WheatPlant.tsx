import { useId, type ReactElement } from 'react';
import { visibleTillers, type PlantModel } from '../engine/plantModel';
import { clamp, clamp01, culmAngle, culmPoint, culmPoints, fmt, hash, leafShape, mix, quad, ribbon, type Culm, type Pt } from '../engine/plantGeometry';

/**
 * SVG-рослина озимої пшениці, що малюється з параметрів PlantModel (див. engine/plantModel.ts).
 * Кількості (листки, пагони кущіння, вузли, частка колоса) — з визначень шкали; висоти, розміри листків
 * і кути — умовні, суто для малюнка. Без Math.random: однакова модель дає однаковий малюнок.
 */
const VB_W = 360, VB_H = 510;
const SOIL = 340, CROWN = 348, SEED_Y = 382, CX = 180;
const STEM_PX = 235, EAR_L = 76;

const C = {
  leaf: '#3E9B4B', leafLight: '#86CC76', leafYellow: '#C4B94B', leafStraw: '#B98F3E',
  stemPale: '#BFDDA0', stem: '#6FAE50', stemStraw: '#D2AE55', sheath: '#8CC46B',
  headGreen: '#8DBF58', headGold: '#E2B94D', awnGreen: '#A9C46A', awnStraw: '#D9B95C',
  seedDry: '#C79A52', seedWet: '#E3CC96', root: '#EADFC3', coleoptile: '#E4EBC6',
};

const leafFill = (sen: number, j: number): string => {
  const base = sen < 0.5 ? mix(C.leaf, C.leafYellow, sen / 0.5) : mix(C.leafYellow, C.leafStraw, (sen - 0.5) / 0.5);
  return mix(base, C.leafLight, 0.16 * hash(j + 3) + (1 - sen) * 0.04);
};

function leafEl(key: string, x: number, y: number, ang: number, len: number, bend: number, width: number, sen: number, j: number): ReactElement | null {
  if (len < 2) return null;
  const { blade, rib } = leafShape(x, y, ang, len, bend, width);
  const fill = leafFill(sen, j);
  return (
    <g key={key}>
      <path d={blade} fill={fill} stroke={mix(fill, '#16391C', 0.38)} strokeWidth={0.6} strokeLinejoin="round" />
      <path d={rib} fill="none" stroke={mix(fill, '#FFFFFF', 0.4)} strokeWidth={0.7} strokeLinecap="round" opacity={0.6} />
    </g>
  );
}

/** Розетка листків від однієї точки: старі — довші й нахилені назовні, наймолодший — прямий і ще росте. */
function leafFan(key: string, n: number, x: number, y: number, scale: number, sen: number, side0: number, lean: number): ReactElement[] {
  const out: ReactElement[] = [];
  const cnt = Math.min(9, Math.ceil(n - 1e-6));
  for (let i = 0; i < cnt; i++) {
    const frac = cnt > 1 ? i / (cnt - 1) : 1;
    const s = (i + side0) % 2 === 0 ? -1 : 1;
    const growth = i === cnt - 1 ? 0.35 + 0.65 * clamp01(n - (cnt - 1)) : 1;
    const len = scale * (40 + 9 * Math.min(i, 8)) * (i === cnt - 1 && cnt > 1 ? 0.8 : 1) * growth;
    const ang = s * (11 + 40 * (1 - frac) + (i % 3) * 2.5) + lean;
    const el = leafEl(`${key}${i}`, x, y, ang, len, s * (26 + 16 * (1 - frac)), scale * (4.6 + 0.34 * Math.min(i, 8)), sen, i + side0 * 7);
    if (el) out.push(el);
  }
  return out;
}

/** Колос: стрижень, колоски (чергуються), ості, пиляки під час цвітіння. Локальні координати: основа в (0,0), угору — мінус y. */
function ear(m: PlantModel, key: string): ReactElement {
  const col = mix(m.ripe > 0 ? mix(C.headGreen, C.headGold, m.ripe) : C.headGreen, '#B8CF6A', m.anthers * 0.18);
  const edge = mix(col, '#4D5A1E', 0.45);
  const awnCol = mix(C.awnGreen, C.awnStraw, m.ripe);
  const awnGrow = clamp01(0.35 + 0.65 * m.head + 0.3 * m.ripe);
  const grow = 1 + 0.28 * m.grain;
  const rows = Array.from({ length: 11 }, (_, i) => ({ i, side: i % 2 ? 1 : -1, y: -(8 + (i * (EAR_L - 24)) / 10) }));
  const topY = -(EAR_L - 6);
  return (
    <g key={key}>
      {m.awns && (
        <g stroke={awnCol} strokeWidth={0.85} strokeLinecap="round" fill="none">
          {rows.map(({ i, side, y }) => {
            const a = (10 + i * 1.2) * (Math.PI / 180), L = awnGrow * (17 + i);
            return <path key={i} d={`M${fmt({ x: side * 5.4, y: y - 6 })}L${fmt({ x: side * 5.4 + side * Math.sin(a) * L, y: y - 6 - Math.cos(a) * L })}`} />;
          })}
          <path d={`M0 ${topY - 4}L0 ${topY - 4 - awnGrow * 26}`} />
        </g>
      )}
      <path d={`M0 0L0 ${topY}`} stroke={edge} strokeWidth={1.6} />
      {rows.map(({ i, side, y }) => (
        <g key={i}>
          <ellipse cx={side * 4.6} cy={y} rx={4.3 * grow} ry={7.6 * (1 + 0.12 * m.grain)} transform={`rotate(${side * 14} ${side * 4.6} ${y})`} fill={col} stroke={edge} strokeWidth={0.6} />
          <path d={`M${side * 4.2} ${y + 6}Q${side * 5.4} ${y} ${side * 5.8} ${y - 6.4}`} fill="none" stroke={mix(col, '#FFFFFF', 0.35)} strokeWidth={0.7} opacity={0.7} />
        </g>
      ))}
      <ellipse cx={0} cy={topY} rx={3.2 * grow} ry={6.2} fill={col} stroke={edge} strokeWidth={0.6} />
      {m.anthers > 0 && rows.slice(2).map(({ i, side, y }) => (
        <g key={`a${i}`} fill="#F4E9A8" stroke="#C9B65A" strokeWidth={0.3} opacity={clamp01(0.3 + m.anthers)}>
          <ellipse cx={side * 9.2} cy={y + 3} rx={1.1 * m.anthers + 0.3} ry={2.7 * m.anthers + 0.5} transform={`rotate(${side * -12} ${side * 9.2} ${y + 3})`} />
          <ellipse cx={side * 8} cy={y + 6.4} rx={1.1 * m.anthers + 0.3} ry={2.5 * m.anthers + 0.5} />
        </g>
      ))}
      {m.dryAnthers > 0 && (
        <g fill="#9A7B45" opacity={0.6 * (1 - m.ripe)}>
          {rows.slice(2).map(({ i, side, y }) => <circle key={`d${i}`} cx={side * 9} cy={y + 4} r={0.9} />)}
        </g>
      )}
    </g>
  );
}

interface CulmOpts { key: string; sw: number; leafScale: number; earScale: number; side: -1 | 1; bulgeK: number }
const NODE_T = [0.16, 0.38, 0.6, 0.8];

/** Одна соломина: стебло, піхви, вузли, листки на вузлах, прапорцевий лист, «черевце» та колос. */
function culm(m: PlantModel, cu: Culm, o: CulmOpts): ReactElement | null {
  if (cu.h < 3) return null;
  const nn = Math.min(4, m.nodes);
  const sen = m.senescence;
  const stemCol = mix(mix(C.stemPale, C.stem, clamp01((m.stem - 0.1) / 0.2)), C.stemStraw, clamp01(sen * 0.7 + m.ripe * 0.6));
  const sheathCol = mix(C.sheath, C.stemStraw, clamp01(sen * 0.8 + m.ripe * 0.5));
  const nodeCol = mix('#7C8F3D', '#8A6D2F', clamp01(sen + m.ripe));
  const stemD = 'M' + culmPoints(cu, 0, 1, 14).map(fmt).join('L');
  const bulge = (m.head > 0 ? 0.9 * (1 - m.head) : m.boot) * o.bulgeK;
  const baseHw = o.sw * 0.6 + 0.8;

  const sheaths: ReactElement[] = [];
  const bumps: ReactElement[] = [];
  const blades: ReactElement[] = [];
  for (let k = 0; k < nn; k++) {
    const flag = k === 3;
    const t0 = NODE_T[k], t1 = flag ? 1 : Math.min(1, t0 + 0.2);
    const N = 8;
    const pts = culmPoints(cu, t0, t1, N);
    const half = pts.map((_, i) => (flag ? baseHw + bulge * 7 * Math.sin(Math.PI * Math.pow(i / N, 0.85)) : baseHw + 0.2));
    sheaths.push(<path key={`s${k}`} d={ribbon(pts, half)} fill={sheathCol} stroke={mix(sheathCol, '#1F4B24', 0.3)} strokeWidth={0.5} />);
    const p = culmPoint(cu, t0);
    bumps.push(<ellipse key={`n${k}`} cx={p.x} cy={p.y} rx={o.sw * 0.62 + 1.6} ry={2.3} transform={`rotate(${culmAngle(cu, t0)} ${p.x} ${p.y})`} fill={nodeCol} />);
    if (k < 3) {
      const s = k % 2 === 0 ? o.side : -o.side;
      const tc = Math.min(1, t0 + 0.2), pc = culmPoint(cu, tc);
      const el = leafEl(`b${k}`, pc.x, pc.y, culmAngle(cu, tc) + s * (28 + 8 * k), o.leafScale * (96 - 4 * k), s * (34 + 6 * k), o.leafScale * 7.2, clamp01(sen * (1.3 - 0.14 * k)), 40 + k);
      if (el) blades.push(el);
    }
  }
  if (nn >= 4 && m.flagLeaf !== 'none') {
    const s = -o.side as -1 | 1, pc = culmPoint(cu, 0.99), a = culmAngle(cu, 0.99);
    const el = m.flagLeaf === 'rolled'
      ? leafEl('flag', pc.x, pc.y, a + s * 3, o.leafScale * 48, s * 4, o.leafScale * 2.8, sen * 0.9, 50)
      : leafEl('flag', pc.x, pc.y, a + s * 26, o.leafScale * 88, s * 38, o.leafScale * 7, sen * 0.9, 50);
    if (el) blades.push(el);
  }

  const top = culmPoint(cu, 1), topA = culmAngle(cu, 1);
  const droop = m.ripe * 10 * o.side;
  const showEar = m.head > 0 || m.awns;
  return (
    <g key={o.key}>
      <path d={stemD} fill="none" stroke={stemCol} strokeWidth={o.sw} strokeLinecap="round" />
      {showEar && (
        <g transform={`translate(${fmt(top)}) rotate(${topA + droop}) translate(0 ${(1 - m.head) * EAR_L * o.earScale}) scale(${o.earScale})`}>{ear(m, 'ear')}</g>
      )}
      {sheaths}
      {bumps}
      {m.sheathOpen && nn >= 4 && m.head < 0.4 && (
        <g transform={`translate(${fmt(top)}) rotate(${topA})`} stroke={mix(sheathCol, '#1F4B24', 0.55)} strokeWidth={0.8} fill="none" strokeLinecap="round">
          <path d={`M${-baseHw - bulge * 3} 0L${-baseHw * 0.7 - bulge * 2} 10`} />
          <path d={`M${baseHw + bulge * 3} 0L${baseHw * 0.7 + bulge * 2} 10`} />
        </g>
      )}
      {blades}
    </g>
  );
}

function rootPath(x0: number, y0: number, dx: number, len: number): { d: string; p0: Pt; p1: Pt; p2: Pt } {
  const p0 = { x: x0, y: y0 }, p1 = { x: x0 + dx * 0.15, y: y0 + len * 0.6 }, p2 = { x: x0 + dx, y: y0 + len };
  return { d: `M${fmt(p0)}Q${fmt(p1)} ${fmt(p2)}`, p0, p1, p2 };
}

function rootEl(key: string, x0: number, y0: number, dx: number, len: number, w: number): ReactElement | null {
  if (len < 3) return null;
  const r = rootPath(x0, y0, dx, len);
  const laterals = [0.25, 0.4, 0.55, 0.7, 0.85].map((t, j) => {
    const q = quad(r.p0, r.p1, r.p2, t);
    const s = j % 2 ? 1 : -1, l = (7 + 10 * hash(j + x0)) * Math.min(1, len / 60);
    return <path key={j} d={`M${fmt(q)}L${fmt({ x: q.x + s * l * 0.9, y: q.y + l * 0.45 })}`} />;
  });
  return (
    <g key={key} stroke={C.root} fill="none" strokeLinecap="round">
      <path d={r.d} strokeWidth={w} />
      <g strokeWidth={w * 0.5} opacity={0.8}>{laterals}</g>
    </g>
  );
}

function roots(m: PlantModel): ReactElement[] {
  const out: ReactElement[] = [];
  if (m.roots <= 0 && m.radicle <= 0) return out;
  const L = clamp(m.roots * 140, 0, 105);
  const sx = CX, sy = SEED_Y + 8;
  const sem = [{ dx: 0, f: 1, th: 0 }, { dx: -26, f: 0.82, th: 0.14 }, { dx: 26, f: 0.82, th: 0.14 }, { dx: -46, f: 0.6, th: 0.3 }, { dx: 46, f: 0.6, th: 0.3 }];
  sem.forEach((r, i) => {
    const g = i === 0 ? 1 : clamp01((m.roots - r.th) / 0.12);
    const len = i === 0 ? Math.max(m.radicle * 40, L) : L * r.f * g;
    const el = rootEl(`r${i}`, sx + r.dx * 0.08, sy, r.dx * g, len, i === 0 ? 1.9 : 1.4);
    if (el) out.push(el);
  });
  const g = clamp01((m.roots - 0.42) / 0.5);
  [{ dx: -34, len: 60 }, { dx: 34, len: 60 }, { dx: -62, len: 44 }, { dx: 62, len: 44 }].forEach((r, i) => {
    const el = rootEl(`c${i}`, CX + Math.sign(r.dx) * 4, CROWN + 2, r.dx * g, r.len * g, 1.5);
    if (el) out.push(el);
  });
  return out;
}

function seed(m: PlantModel): ReactElement {
  const imb = m.imbibition;
  const fill = mix(C.seedDry, C.seedWet, imb);
  const decay = m.code >= 30 ? 0.55 : 1;
  const top = SEED_Y - 9;
  const colH = (top - (SOIL - 4)) * m.coleoptile;
  return (
    <g>
      {imb > 0 && <circle cx={CX} cy={SEED_Y} r={19} fill="#7FB7D6" opacity={imb * 0.2} />}
      {m.coleoptile > 0 && (
        <path d={`M${CX - 3} ${top + 2}L${CX - 2.4} ${top - colH + 3}Q${CX} ${top - colH - 3} ${CX + 2.4} ${top - colH + 3}L${CX + 3} ${top + 2}Z`} fill={C.coleoptile} stroke={mix(C.coleoptile, '#6D7A3A', 0.4)} strokeWidth={0.6} />
      )}
      <g opacity={decay} transform={`rotate(-8 ${CX} ${SEED_Y})`}>
        <ellipse cx={CX} cy={SEED_Y} rx={5.2 + 1.8 * imb} ry={9 + 1.6 * imb} fill={fill} stroke={mix(fill, '#4D3A1C', 0.5)} strokeWidth={0.8} />
        <path d={`M${CX + 1.4} ${SEED_Y - 7}Q${CX - 1.4} ${SEED_Y} ${CX + 1.4} ${SEED_Y + 7}`} fill="none" stroke={mix(fill, '#4D3A1C', 0.5)} strokeWidth={0.8} />
      </g>
    </g>
  );
}

/** Висота надземної частини в px (для «камери»): умовна, лише щоб кадрувати малюнок. */
function aerialExtent(m: PlantModel): number {
  if (m.harvested) return 30;
  if (m.stem > 0) return Math.max(110, STEM_PX * m.stem + (m.head > 0 || m.awns ? EAR_L * m.head + 30 : 20));
  const n = Math.max(m.leaves, m.leafGrow * 0.5);
  return n > 0 ? 0.9 * (40 + 9 * Math.min(n, 8)) + 12 : 14;
}

const r = (n: number): number => Math.round(n * 100) / 100;

export interface WheatPlantProps {
  model: PlantModel;
  /** Опис для скрінрідерів, напр. «Пшениця, BBCH 32». */
  label: string;
  /** Підпис лінії ґрунту (необов'язково). */
  soilLabel?: string;
  className?: string;
}

export function WheatPlant({ model: m, label, soilLabel, className }: WheatPlantProps) {
  const uid = useId().replace(/:/g, '');
  const aerial: ReactElement[] = [];
  const drawn = visibleTillers(m); // після BBCH 90 шкала пагони не лічить, але вони нікуди не зникають
  const tillers = Array.from({ length: Math.ceil(drawn - 1e-6) }, (_, k) => ({
    k, g: clamp01(drawn - k), side: (k % 2 === 0 ? -1 : 1) as -1 | 1, ring: Math.floor(k / 2),
  }));
  // «Камера»: наближаємо, поки рослина низька (висота неба над ґрунтом ~ висота рослини), далі масштаб 1.
  const y0 = m.lodged && !m.harvested ? 0 : clamp(SOIL - (aerialExtent(m) * 1.12 + 24), 0, 255);
  const z = (VB_H - y0) / VB_H;
  const vbX = CX - (VB_W * z) / 2;

  if (!m.harvested) {
    // 1) розетки пагонів кущіння (позаду)
    tillers.forEach(({ k, g, side, ring }) => {
      const n = [6, 5, 5, 4, 4][k];
      aerial.push(<g key={`tr${k}`}>{leafFan(`tr${k}-`, n * g, CX + side * (12 + 10 * ring), SOIL - 2, (m.stem > 0 ? 0.5 : 0.82) * g, clamp01((m.stem > 0 ? 0.08 : 0) + m.senescence), k, side * (30 + 14 * ring))}</g>);
    });
    // 2) стебла-пагони кущіння
    if (m.stem > 0) {
      tillers.forEach(({ k, g, side, ring }) => {
        const h = STEM_PX * m.stem * (0.74 - 0.05 * k) * g;
        const el = culm(m, { x0: CX + side * (12 + 10 * ring), y0: CROWN, h, reach: side * (28 + 18 * ring) * clamp01(h / 120) }, { key: `tc${k}`, sw: 3.2, leafScale: 0.74, earScale: 0.84, side, bulgeK: 0.75 });
        if (el) aerial.push(el);
      });
    }
    // 3) розетка головного пагона: до 30 — усі листки, далі — нижні (старіші) листки
    const nMain = m.stem > 0 ? 4 : Math.max(m.leaves, m.leafGrow * 0.5);
    aerial.push(<g key="rosette">{leafFan('m', nMain, CX, SOIL - 2, m.stem > 0 ? 0.95 : 1, m.stem > 0 ? clamp01(0.08 + m.senescence) : m.senescence, 0, 0)}</g>);
    // 4) головне стебло
    if (m.stem > 0) {
      const el = culm(m, { x0: CX, y0: CROWN, h: STEM_PX * m.stem, reach: 0 }, { key: 'main', sw: 4.4, leafScale: 1, earScale: 1, side: -1, bulgeK: 1 });
      if (el) aerial.push(el);
    }
  } else {
    // 99: збирання — стерня
    [-30, -18, -7, 5, 17, 28].forEach((dx, i) => aerial.push(<rect key={`st${i}`} x={CX + dx} y={SOIL - 26 - 8 * hash(i)} width={4.4} height={28 + 8 * hash(i)} rx={1.4} fill={C.stemStraw} stroke={mix(C.stemStraw, '#5A4519', 0.4)} strokeWidth={0.5} />));
  }

  const lodgeStyle = { transformOrigin: `${CX}px ${CROWN}px`, transform: m.lodged && !m.harvested ? 'translate(-60px,0px) rotate(50deg) scale(0.85)' : 'translate(0px,0px) rotate(0deg) scale(1)', transition: 'transform .8s ease' };
  const fallen = m.harvested ? 0 : Math.round(m.shedding * 9);
  const heap = m.harvested ? Array.from({ length: 28 }, (_, i) => ({ x: CX + 18 + hash(i) * 62, y: SOIL - 3 - (1 - Math.abs((hash(i) - 0.5) * 2)) * 14 * hash(i + 9) })) : [];

  return (
    <svg className={className} viewBox={`${r(vbX)} ${r(y0)} ${r(VB_W * z)} ${r(VB_H * z)}`} role="img" aria-label={label} preserveAspectRatio="xMidYMax meet" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--plant-sky1, #DDF1F7)' }} />
          <stop offset="1" style={{ stopColor: 'var(--plant-sky2, #F3F8EC)' }} />
        </linearGradient>
        <linearGradient id={`soil${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--plant-soil1, #7B5A3C)' }} />
          <stop offset="1" style={{ stopColor: 'var(--plant-soil2, #3F2C1F)' }} />
        </linearGradient>
        <radialGradient id={`sun${uid}`} cx="0.85" cy="0.08" r="0.5">
          <stop offset="0" stopColor="#FFF3C4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFF3C4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={VB_W} height={SOIL} fill={`url(#sky${uid})`} />
      <rect width={VB_W} height={SOIL} fill={`url(#sun${uid})`} />
      <rect y={SOIL} width={VB_W} height={VB_H - SOIL} fill={`url(#soil${uid})`} />
      <path d={`M0 ${SOIL}Q60 ${SOIL - 3} 120 ${SOIL}T240 ${SOIL}T360 ${SOIL}`} fill="none" stroke="#2F6B34" strokeWidth={2.2} opacity={0.55} />
      <g aria-hidden="true">
        {Array.from({ length: 64 }, (_, i) => (
          <circle key={i} cx={hash(i) * VB_W} cy={SOIL + 8 + hash(i + 100) * (VB_H - SOIL - 12)} r={0.8 + hash(i + 200) * 1.7} fill={i % 3 ? '#000' : '#fff'} opacity={0.08 + hash(i + 300) * 0.08} />
        ))}
      </g>
      {soilLabel && <text x={vbX + 8 * z} y={SOIL + 16 * z} fontSize={11 * z} fill="#fff" opacity={0.75} fontFamily="system-ui,sans-serif">{soilLabel}</text>}
      <ellipse cx={CX} cy={SOIL + 1} rx={46} ry={4} fill="#000" opacity={0.14 * clamp01((aerialExtent(m) - 20) / 50)} />
      {roots(m)}
      {!m.harvested && seed(m)}
      <g style={lodgeStyle}>{aerial}</g>
      {Array.from({ length: fallen }, (_, i) => (
        <ellipse key={`f${i}`} cx={50 + hash(i + 40) * 260} cy={SOIL - 3} rx={2.6} ry={1.6} fill={C.headGold} stroke="#8A6D2F" strokeWidth={0.4} />
      ))}
      {heap.map((g, i) => <ellipse key={`h${i}`} cx={g.x} cy={g.y} rx={4.6} ry={2.6} fill={C.seedWet} stroke="#8A6D2F" strokeWidth={0.4} transform={`rotate(${hash(i + 5) * 60 - 30} ${g.x} ${g.y})`} />)}
    </svg>
  );
}
