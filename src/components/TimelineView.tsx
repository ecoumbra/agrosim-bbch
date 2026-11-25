import { useEffect, useMemo, useState } from 'react';
import type { Dict } from '../i18n';
import type { Crop, Lang, Verification } from '../types';
import { crops } from '../data/crops';
import { principalStages } from '../data/principalStages';
import { displayCode } from '../engine/scale';
import { plantModel, type Season } from '../engine/plantModel';
import { indexOfCode, keyStages, principalSegments, seasonStrip, showsStemSection } from '../engine/timeline';
import { useTweenedModel } from '../hooks/useTweenedModel';
import { WheatPlant } from './WheatPlant';
import { StemSection } from './StemSection';

const VERIF: Record<Verification, keyof Dict> = { 'cross-checked': 'crossChecked', authored: 'authored', unverified: 'unverified' };
const SEASON_KEY: Record<Season, keyof Dict> = { autumn: 'seasonAutumn', winter: 'seasonWinter', spring: 'seasonSpring', earlySummer: 'seasonEarlySummer', summer: 'seasonSummer' };
const AUTOPLAY_MS = 1300;
const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k]));
const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface TimelineViewProps {
  lang: Lang;
  t: Dict;
  /** Поточний код BBCH (керується батьком, щоб Атлас міг «показати на рослині»). */
  code: number;
  onCode: (code: number) => void;
  crop?: Crop;
  onOpenAtlas?: (code: number) => void;
}

/** Лінія розвитку: слайдер по кодах шкали культури, автопрогін, ключові фази, SVG-рослина, розріз стебла, сезонна стрічка. */
export function TimelineView({ lang, t, code, onCode, crop = crops[0], onOpenAtlas }: TimelineViewProps) {
  const stages = crop.stages;
  const last = stages.length - 1;
  const idx = indexOfCode(crop, code);
  const stage = stages[idx];
  const [playing, setPlaying] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const model = useTweenedModel(stage.code, reduced ? 1 : 450);
  const target = useMemo(() => plantModel(stage.code), [stage.code]);
  const segments = useMemo(() => principalSegments(crop), [crop]);
  const keys = useMemo(() => keyStages(crop), [crop]);
  const season = seasonStrip(stage.code);
  const go = (i: number) => onCode(stages[Math.min(last, Math.max(0, i))].code);
  const manual = (i: number) => { setPlaying(false); go(i); };

  useEffect(() => {
    if (!playing) return;
    if (idx >= last) { setPlaying(false); return; }
    const id = setTimeout(() => onCode(stages[idx + 1].code), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [playing, idx, last, stages, onCode]);

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (idx >= last) onCode(stages[0].code);
    setPlaying(true);
  };
  const label = `BBCH ${displayCode(stage.code)} · ${stage.name[lang]}`;

  return (
    <div className="tl-grid">
      <div className="tl-left">
        <section className="card">
          <div className="plant-wrap tl-plant">
            <WheatPlant model={model} label={fill(t.tlPlantAlt, { c: displayCode(stage.code) })} soilLabel={t.tlSoil} />
          </div>
          <p className="note">{t.tlPlantNote}</p>
        </section>

        <section className="card tl-controls">
          <div className="tl-row">
            <button onClick={() => manual(idx - 1)} disabled={idx <= 0} aria-label={t.tlPrev}>‹</button>
            <button onClick={togglePlay} aria-pressed={playing} aria-label={playing ? t.tlPause : t.tlPlay}>{playing ? '⏸' : '▶'}</button>
            <button onClick={() => manual(idx + 1)} disabled={idx >= last} aria-label={t.tlNext}>›</button>
            <span className="tl-now"><b>BBCH {displayCode(stage.code)}</b><small>{fill(t.tlStep, { i: idx + 1, n: stages.length })}</small></span>
          </div>
          <p className="tl-name">{stage.name[lang]}</p>
          <input
            className="tl-range" type="range" min={0} max={last} step={1} value={idx}
            onChange={(e) => manual(Number(e.target.value))}
            aria-label={t.tlSlider} aria-valuetext={label}
          />
          <div className="tl-bar" role="group" aria-label={t.tlPrincipal}>
            {segments.map((s) => (
              <button key={s.id} style={{ flex: s.count + 5 }} className="tl-seg" aria-current={stage.principal === s.id ? 'true' : undefined}
                title={`${s.id}: ${principalStages[s.id].name[lang]}`} onClick={() => { setPlaying(false); onCode(s.firstCode); }}>{s.id}</button>
            ))}
          </div>
          <div className="tl-chips" role="group" aria-label={t.tlKey}>
            {keys.map((k) => (
              <button key={k.code} className="chip-btn" aria-pressed={k.code === stage.code} title={k.name[lang]} onClick={() => { setPlaying(false); onCode(k.code); }}>
                <b>{displayCode(k.code)}</b>{k.traditional && <small> {k.traditional[lang].replace(/ — орієнтовно$/, '')}</small>}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="tl-right">
        <section className="card tl-stage" aria-live={playing ? 'off' : 'polite'}>
          <p className="tl-principal">{t.principal} {stage.principal}: {principalStages[stage.principal].name[lang]}</p>
          <h2><span className="code" data-p={stage.principal}>{displayCode(stage.code)}</span> {stage.name[lang]}</h2>
          {stage.traditional && <p className="note">{t.traditional}: {stage.traditional[lang]}</p>}
          <p>{stage.description[lang]}</p>
          {stage.howToCheck && <div className="tip"><b>{t.howto}</b><p>{stage.howToCheck[lang]}</p><small>{t.authored}</small></div>}
          <p className="tl-meta">
            <span className={`badge v-${stage.verification}`}>{t[VERIF[stage.verification]]}</span>
            {onOpenAtlas && <button className="chip-btn" onClick={() => onOpenAtlas(stage.code)}>{t.tlOpenAtlas}</button>}
          </p>
        </section>

        {showsStemSection(stage.code)
          ? <section className="card"><h3>{t.stemTitle}</h3><StemSection model={target} lang={lang} /></section>
          : <p className="note tl-hint">{t.tlStemOnly}</p>}

        <section className="card">
          <h3>{t.tlSeason}</h3>
          <ol className="tl-seasons" aria-label={t.tlSeason}>
            {season.map(({ season: s, state }) => (
              <li key={s} data-state={state} aria-current={state === 'active' ? 'step' : undefined}>{t[SEASON_KEY[s]]}</li>
            ))}
          </ol>
          {season.some((x) => x.season === 'winter' && x.state === 'between') && <p className="note">{t.tlWinter}</p>}
          <p className="note">{t.tlSeasonNote}</p>
        </section>
      </div>
    </div>
  );
}
