import { useMemo, useState } from 'react';
import type { Dict } from '../i18n';
import type { Crop, Lang } from '../types';
import { crops } from '../data/crops';
import { displayCode, stageByCode } from '../engine/scale';
import { plantModel } from '../engine/plantModel';
import { makeRng } from '../engine/trainer';
import {
  type Field, type FieldStats, type Tool, TOOL_GROUPS,
  bounds, distribution, emptyFieldStats, fieldCodes, fieldStage, grade, isFieldStats, makeScenario, randomSample, reading, recordField, samplingAccuracy, shareAtLeast,
} from '../engine/field';
import { useLocalState } from '../hooks/useLocalState';
import { WheatPlant } from './WheatPlant';
import { StemSection } from './StemSection';

const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k]));
export const SAMPLE_SIZES = [5, 10, 20, 50] as const;
const defaultSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;

/** Один обхід поля: поле, вибірка, використані інструменти, записи студента, відповідь. */
export interface Round {
  field: Field; k: number; draw: number; sample: number[] | null;
  used: Record<number, Tool[]>; guess: Record<number, number>; answer: number | null;
}
const newRound = (field: Field, k: number): Round => ({ field, k, draw: 0, sample: null, used: {}, guess: {}, answer: null });

const stageName = (crop: Crop, code: number, lang: Lang): string => `${displayCode(code)} · ${stageByCode(crop, code)?.name[lang] ?? ''}`;

/** Запис студента про рослину: однозначне показання або його вибір серед кандидатів (інакше — ще не записано). */
export function recorded(crop: Crop, r: Round, i: number): number | null {
  const rd = reading(crop, r.field.plants[i], ['eye', ...(r.used[i] ?? [])]);
  if (rd.resolved) return rd.candidates[0];
  const g = r.guess[i];
  return g !== undefined && rd.candidates.includes(g) ? g : null;
}

// ---------------------------------------------------------------- допоміжні елементи
function Bars({ rows, total, label, hits }: { rows: { code: number; count: number }[]; total: number; label: string; hits: number[] }) {
  return (
    <ul className="plain fd-bars" aria-label={label}>
      {rows.map((d) => (
        <li key={d.code} data-hit={hits.includes(d.code)}>
          <span className="code">{displayCode(d.code)}</span>
          <span className="fd-bar" style={{ width: `${Math.max(2, (100 * d.count) / Math.max(1, total))}%` }} aria-hidden="true" />
          <b>{d.count}</b>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- налаштування
export interface FieldSetupProps { t: Dict; k: number; onK: (k: number) => void; stats: FieldStats; onStart: () => void; onResetStats: () => void }
export function FieldSetup({ t, k, onK, stats, onStart, onResetStats }: FieldSetupProps) {
  const [sure, setSure] = useState(false);
  const sizes = Object.entries(stats.bySize).sort(([a], [b]) => Number(a) - Number(b)).map(([s, v]) => `${s} — ${v.exact}/${v.n}`).join('; ');
  return (
    <section className="card fd-setup">
      <h2>{t.fdTitle}</h2>
      <p>{t.fdIntro}</p>
      <p className="note">{t.fdRuleNote}</p>
      <fieldset className="tr-levels">
        <legend>{t.fdSize}</legend>
        <div className="fd-sizes" role="radiogroup" aria-label={t.fdSize}>
          {SAMPLE_SIZES.map((n) => (
            <label key={n} className="tr-level" data-checked={k === n}>
              <input type="radio" name="k" value={n} checked={k === n} onChange={() => onK(n)} /><span><b>{n}</b></span>
            </label>
          ))}
        </div>
        <p className="note">{t.fdSizeHint}</p>
      </fieldset>
      <p><button className="primary" onClick={onStart}>{t.fdStart}</button></p>
      <p className="note">{stats.runs ? fill(t.fdStatsLine, { runs: stats.runs, exact: stats.exact, adj: stats.adjacent, off: stats.off }) : t.fdStatsNone}</p>
      {sizes && <p className="note">{fill(t.fdStatsSize, { list: sizes })}</p>}
      {stats.runs > 0 && <p><button className="chip-btn" onClick={() => { if (sure) { onResetStats(); setSure(false); } else setSure(true); }}>{sure ? t.trResetSure : t.trReset}</button></p>}
    </section>
  );
}

// ---------------------------------------------------------------- відбір, огляд, відповідь
export interface FieldWorkProps {
  round: Round; crop: Crop; lang: Lang; t: Dict;
  onDraw: () => void; onTool: (i: number, tool: Tool) => void; onToolAll: (tool: Tool) => void; onGuess: (i: number, code: number) => void; onAnswer: (code: number) => void;
}
export function FieldWork({ round, crop, lang, t, onDraw, onTool, onToolAll, onGuess, onAnswer }: FieldWorkProps) {
  const sample = round.sample;
  const [sel, setSel] = useState<number | null>(null);
  const [pick, setPick] = useState('');
  const inspected = Object.keys(round.used).length > 0 || Object.keys(round.guess).length > 0;
  const readings = sample ? sample.map((i) => reading(crop, round.field.plants[i], ['eye', ...(round.used[i] ?? [])])) : [];
  const recs = sample ? sample.map((i) => recorded(crop, round, i)) : [];
  const done = recs.filter((c): c is number => c !== null);
  const pending = recs.length - done.length;
  const dist = distribution(done);
  const b = readings.length ? bounds(readings) : null;
  const cur = sample && sample.length ? (sel !== null && sample.includes(sel) ? sel : sample[0]) : null;
  const curReading = cur !== null ? reading(crop, round.field.plants[cur], ['eye', ...(round.used[cur] ?? [])]) : null;
  const curModel = curReading ? plantModel(curReading.candidates[0]) : null;
  const curCut = cur !== null && (round.used[cur] ?? []).includes('cut');
  const options = useMemo(() => fieldCodes(crop), [crop]);

  return (
    <div className="fd-grid">
      <div className="fd-left">
        <section className="card">
          <h2>{t.fdMapTitle}</h2>
          <div className="fd-map" role="group" aria-label={t.fdMapTitle}>
            {round.field.plants.map((_, i) => {
              const n = sample ? sample.indexOf(i) + 1 : 0;
              if (n === 0) return <span key={i} className="fd-cell" aria-hidden="true" />;
              const ok = recs[n - 1] !== null;
              return (
                <button key={i} className="fd-cell" data-sampled="true" data-state={ok ? 'ok' : 'todo'} aria-pressed={cur === i} aria-label={fill(t.fdPlant, { n })} onClick={() => setSel(i)}>{n}</button>
              );
            })}
          </div>
          <p className="note">{t.fdMapNote}</p>
          <p className="tr-actions">
            <button className="primary" onClick={onDraw} disabled={inspected}>{sample ? t.fdRedraw : fill(t.fdDraw, { k: round.k })}</button>
          </p>
          {inspected && <p className="note">{t.fdRedrawLocked}</p>}
        </section>

        {curModel && curReading && (
          <section className="card fd-detail">
            <h3>{cur !== null && sample ? fill(t.fdPlant, { n: sample.indexOf(cur) + 1 }) : ''}</h3>
            {curCut ? <StemSection model={curModel} lang={lang} quiz /> : <div className="plant-wrap tr-plant"><WheatPlant model={curModel} label={t.trPlantAlt} soilLabel={t.tlSoil} /></div>}
          </section>
        )}
      </div>

      <div className="fd-right">
        {sample && (
          <>
            <section className="card">
              <p className="note">{fill(t.fdSampledNote, { n: sample.length })}</p>
              <p className="tr-actions">
                <button className="chip-btn" onClick={() => onToolAll('cut')}>{t.fdToolCutAll}</button>
                <button className="chip-btn" onClick={() => onToolAll('nail')}>{t.fdToolNailAll}</button>
              </p>
              <ol className="plain fd-list">
                {sample.map((i, idx) => {
                  const rd = readings[idx];
                  const used = round.used[i] ?? [];
                  const need = rd.needs === 'cut' ? t.fdNeedCut : t.fdNeedNail;
                  return (
                    <li key={i} className="fd-row" data-state={recs[idx] !== null ? 'ok' : 'todo'} data-selected={cur === i}>
                      <button className="fd-pick" aria-pressed={cur === i} onClick={() => setSel(i)}>{fill(t.fdPlant, { n: idx + 1 })}</button>
                      <span className="fd-read">
                        {rd.resolved ? stageName(crop, rd.candidates[0], lang) : fill(t.fdReadRange, { lo: displayCode(Math.min(...rd.candidates)), hi: displayCode(Math.max(...rd.candidates)), tool: need })}
                      </span>
                      <span className="fd-tools">
                        {TOOL_GROUPS.map((g) => (
                          <button key={g.tool} className="chip-btn" aria-pressed={used.includes(g.tool)} onClick={() => onTool(i, g.tool)}>{g.tool === 'cut' ? t.fdToolCut : t.fdToolNail}</button>
                        ))}
                      </span>
                      {!rd.resolved && (
                        <label className="fd-guess">{t.fdGuess}
                          <select value={round.guess[i] ?? ''} onChange={(e) => onGuess(i, Number(e.target.value))}>
                            <option value="">{t.fdGuessNone}</option>
                            {rd.candidates.map((c) => <option key={c} value={c}>{stageName(crop, c, lang)}</option>)}
                          </select>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="card">
              <h3>{t.fdTable}</h3>
              <table className="fd-table">
                <thead><tr><th>{t.fdColStage}</th><th>{t.fdColCount}</th><th>{t.fdColReached}</th></tr></thead>
                <tbody>
                  {dist.map((d) => <tr key={d.code}><td>{stageName(crop, d.code, lang)}</td><td>{d.count}</td><td>{Math.round(100 * shareAtLeast(done, d.code))}%</td></tr>)}
                </tbody>
              </table>
              {pending > 0 && <p className="note" role="status">{fill(t.fdPending, { n: pending })}</p>}
              {b && b.low !== b.high && <p className="note">{fill(t.fdBounds, { lo: displayCode(b.low), hi: displayCode(b.high) })}</p>}
            </section>

            <section className="card">
              <h3>{t.fdAnswerTitle}</h3>
              <p className="note">{t.fdAnswerAsk}</p>
              <p>
                <select aria-label={t.fdAnswerTitle} value={pick} onChange={(e) => setPick(e.target.value)} disabled={pending > 0}>
                  <option value="">{t.fdGuessNone}</option>
                  {options.map((c) => <option key={c} value={c}>{stageName(crop, c, lang)}</option>)}
                </select>
              </p>
              <p><button className="primary" disabled={pending > 0 || pick === ''} onClick={() => onAnswer(Number(pick))}>{t.fdAnswerBtn}</button></p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- результат
export interface FieldResultProps { round: Round; crop: Crop; lang: Lang; t: Dict; onAgain: () => void; onSetup: () => void; onOpenAtlas?: (code: number) => void }
export function FieldResult({ round, crop, lang, t, onAgain, onSetup, onOpenAtlas }: FieldResultProps) {
  const sample = round.sample ?? [];
  const recs = sample.map((i) => recorded(crop, round, i)).filter((c): c is number => c !== null);
  const bySample = fieldStage(recs), truth = fieldStage(round.field.plants), answer = round.answer ?? bySample;
  const g = grade(crop, answer, truth);
  const TRIALS = 300;
  const acc = useMemo(() => SAMPLE_SIZES.map((k) => ({ k, p: Math.round(100 * samplingAccuracy(round.field, k, TRIALS, round.field.seed)) })), [round.field]);
  const mine = acc.find((a) => a.k === round.k);
  const outcome = g.outcome === 'exact' ? t.fdOutcomeExact : g.outcome === 'adjacent' ? t.fdOutcomeAdj : t.fdOutcomeOff;
  return (
    <section className="card fd-result" data-outcome={g.outcome}>
      <h2>{t.fdResult}: {outcome}</h2>
      <table className="fd-table">
        <tbody>
          <tr><th scope="row">{t.fdYours}</th><td>{stageName(crop, answer, lang)}</td></tr>
          <tr><th scope="row">{t.fdBySample}</th><td>{stageName(crop, bySample, lang)}</td></tr>
          <tr><th scope="row">{t.fdTruth}</th><td>{stageName(crop, truth, lang)}</td></tr>
        </tbody>
      </table>
      {answer !== bySample && <p>{fill(t.fdMisapplied, { s: displayCode(bySample), a: displayCode(answer) })}</p>}
      <p>{bySample === truth ? fill(t.fdSampleOk, { k: round.k }) : fill(t.fdSampleError, { k: round.k, s: displayCode(bySample), t: displayCode(truth) })}</p>
      {mine && <p className="note">{fill(t.fdAccuracy, { k: round.k, p: mine.p, n: TRIALS })}</p>}
      <h3>{t.fdAccTable}</h3>
      <ul className="plain fd-acc">{acc.map((a) => <li key={a.k} data-current={a.k === round.k}><b>{a.k}</b> — {a.p}%</li>)}</ul>
      <div className="fd-dists">
        <div><h3>{t.fdSampleDist}</h3><Bars rows={distribution(recs)} total={recs.length} label={t.fdSampleDist} hits={[bySample]} /></div>
        <div><h3>{t.fdFieldDist}</h3><Bars rows={distribution(round.field.plants)} total={round.field.plants.length} label={t.fdFieldDist} hits={[truth]} /></div>
      </div>
      <p className="note">{t.fdRuleNote}</p>
      <p className="tr-actions">
        <button className="primary" onClick={onAgain}>{t.fdAgain}</button>
        <button className="chip-btn" onClick={onSetup}>{t.fdSetup}</button>
        {onOpenAtlas && <button className="chip-btn" onClick={() => onOpenAtlas(truth)}>{t.tlOpenAtlas}</button>}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- екран
export interface FieldViewProps { lang: Lang; t: Dict; crop?: Crop; onOpenAtlas?: (code: number) => void; makeSeed?: () => number }

/** Польова діагностика: віртуальне поле → відбір рослин → огляд інструментами → фаза поля за правилом 50% → розбір. */
export function FieldView({ lang, t, crop = crops[0], onOpenAtlas, makeSeed = defaultSeed }: FieldViewProps) {
  const [stats, setStats] = useLocalState<FieldStats>('bbch.field.stats', emptyFieldStats(), isFieldStats);
  const [k, setK] = useLocalState<number>('bbch.field.k', 10, (v) => (SAMPLE_SIZES as readonly unknown[]).includes(v));
  const [round, setRound] = useState<Round | null>(null);

  const begin = () => setRound(newRound(makeScenario(crop, makeSeed()), k));
  if (!round) return <FieldSetup t={t} k={k} onK={setK} stats={stats} onStart={begin} onResetStats={() => setStats(emptyFieldStats())} />;

  const draw = () => setRound((r) => {
    if (!r) return r;
    const d = r.draw + 1;
    return { ...r, draw: d, sample: randomSample(r.field, r.k, makeRng((r.field.seed ^ Math.imul(d, 0x9e3779b1)) >>> 0)), used: {}, guess: {} };
  });
  const tool = (i: number, tl: Tool) => setRound((r) => (r ? { ...r, used: { ...r.used, [i]: [...new Set([...(r.used[i] ?? []), tl])] } } : r));
  const toolAll = (tl: Tool) => setRound((r) => (r && r.sample ? { ...r, used: Object.fromEntries(r.sample.map((i) => [i, [...new Set([...(r.used[i] ?? []), tl])]])) } : r));
  const guess = (i: number, code: number) => setRound((r) => {
    if (!r) return r;
    const g = { ...r.guess };
    if (!Number.isInteger(code) || code <= 0) delete g[i]; else g[i] = code; // порожній вибір ("") → Number = 0: запис знімається
    return { ...r, guess: g };
  });
  const answer = (code: number) => {
    if (!round.sample) return;
    const truth = fieldStage(round.field.plants);
    setStats((s) => recordField(s, grade(crop, code, truth).outcome, round.k));
    setRound({ ...round, answer: code });
  };

  if (round.answer !== null) return <FieldResult round={round} crop={crop} lang={lang} t={t} onAgain={begin} onSetup={() => setRound(null)} onOpenAtlas={onOpenAtlas} />;
  return <FieldWork round={round} crop={crop} lang={lang} t={t} onDraw={draw} onTool={tool} onToolAll={toolAll} onGuess={guess} onAnswer={answer} />;
}
