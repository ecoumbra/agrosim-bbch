import { useEffect, useRef, useState } from 'react';
import type { Dict } from '../i18n';
import type { Crop, Lang, Photo, Stage } from '../types';
import { crops } from '../data/crops';
import { PHOTOS } from '../data/photos';
import { principalStages } from '../data/principalStages';
import { displayCode, stageByCode } from '../engine/scale';
import { plantModel } from '../engine/plantModel';
import { photoCodes, photoUrl, pickPhoto } from '../engine/photos';
import { type Answer, type Level, type Question, type Stats, type Summary, type Visual, buildSession, check, isStats, makeRng, recordAnswer, summarize, weakCodes } from '../engine/trainer';
import { useLocalState } from '../hooks/useLocalState';
import { WheatPlant } from './WheatPlant';
import { StemSection } from './StemSection';

const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k]));
const LEVELS: Level[] = ['principal', 'phase', 'compare'];
const LV: Record<Level, [keyof Dict, keyof Dict]> = { principal: ['trLvPrincipal', 'trLvPrincipalD'], phase: ['trLvPhase', 'trLvPhaseD'], compare: ['trLvCompare', 'trLvCompareD'] };
const ASK: Record<Level, keyof Dict> = { principal: 'trAskPrincipal', phase: 'trAskPhase', compare: 'trAskCompare' };
const defaultSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
const defaultBase = (): string => import.meta.env?.BASE_URL ?? './';
/** Чи завантажується зображення (із тайм-аутом): питання з фото, яке не завантажилось, не ставимо. */
const defaultLoadImage = (url: string): Promise<boolean> => new Promise((resolve) => {
  const img = new Image();
  const timer = setTimeout(() => resolve(false), 10000);
  img.onload = () => { clearTimeout(timer); resolve(true); };
  img.onerror = () => { clearTimeout(timer); resolve(false); };
  img.src = url;
});

/** Підпис варіанта: для рівня «головна стадія» — id стадії, інакше — код фази. */
function optionLabel(level: Level, opt: number, crop: Crop, lang: Lang, t: Dict): string {
  if (level === 'principal') return `${t.principal} ${opt}: ${principalStages[opt].name[lang]}`;
  const s = stageByCode(crop, opt);
  return `${displayCode(opt)} · ${s ? s.name[lang] : ''}`;
}

function StageBlock({ s, lang, t }: { s: Stage; lang: Lang; t: Dict }) {
  return (
    <div className="tr-stage">
      <p><b>{displayCode(s.code)} · {s.name[lang]}</b>{s.traditional && <small> ({s.traditional[lang]})</small>}</p>
      <p>{s.description[lang]}</p>
      {s.howToCheck && <div className="tip"><b>{t.howto}</b><p>{s.howToCheck[lang]}</p><small>{t.authored}</small></div>}
    </div>
  );
}

// ---------------------------------------------------------------- налаштування
export interface SetupViewProps {
  t: Dict; level: Level; onLevel: (l: Level) => void; weak: boolean; onWeak: (v: boolean) => void;
  weakList: number[]; stats: Stats; onStart: () => void; onResetStats: () => void; empty: boolean;
  /** Режим зображень і скільки фото є (фото для скількох фаз). Без фото вибір режиму не показується. */
  mode?: Visual; onMode?: (m: Visual) => void; photoCount?: number; photoPhases?: number; loading?: boolean; photoFail?: boolean;
}
export function SetupView({ t, level, onLevel, weak, onWeak, weakList, stats, onStart, onResetStats, empty, mode = 'svg', onMode, photoCount = 0, photoPhases = 0, loading = false, photoFail = false }: SetupViewProps) {
  const [sure, setSure] = useState(false);
  const all = Object.values(stats);
  const n = all.reduce((a, s) => a + s.n, 0), ok = all.reduce((a, s) => a + s.ok, 0);
  return (
    <section className="card tr-setup">
      <h2>{t.trTitle}</h2>
      <p className="note">{t.trIntro}</p>
      <fieldset className="tr-levels">
        <legend>{t.trLevel}</legend>
        {LEVELS.map((l) => (
          <label key={l} className="tr-level" data-checked={level === l}>
            <input type="radio" name="level" value={l} checked={level === l} onChange={() => onLevel(l)} />
            <span><b>{t[LV[l][0]]}</b><small>{t[LV[l][1]]}</small></span>
          </label>
        ))}
      </fieldset>
      {photoCount > 0 && onMode ? (
        <fieldset className="tr-levels">
          <legend>{t.trMode}</legend>
          {(['svg', 'photo'] as Visual[]).map((m) => (
            <label key={m} className="tr-level" data-checked={mode === m}>
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => onMode(m)} />
              <span><b>{m === 'svg' ? t.trModeSvg : t.trModePhoto}</b><small>{m === 'svg' ? t.trModeSvgD : t.trModePhotoD}</small></span>
            </label>
          ))}
          <p className="note">{fill(t.trPhotoCount, { n: photoCount, m: photoPhases })}</p>
        </fieldset>
      ) : <p className="note">{t.trNoPhotos}</p>}
      <label className="tr-weak">
        <input type="checkbox" checked={weak} disabled={weakList.length === 0} onChange={(e) => onWeak(e.target.checked)} />
        <span>{t.trWeak}</span>
      </label>
      <p className="note">{weakList.length ? fill(t.trWeakList, { list: weakList.map(displayCode).join(', ') }) : t.trWeakNone}</p>
      {empty && <p className="note" role="alert">{photoFail ? t.trPhotoFail : t.trEmpty}</p>}
      <p><button className="primary" onClick={onStart} disabled={loading}>{loading ? t.trPhotoLoading : t.trStart}</button></p>
      <p className="note">{n ? fill(t.trStatsLine, { ok, n, p: Math.round((100 * ok) / n) }) : t.trStatsNone}</p>
      {n > 0 && (
        <p>
          <button className="chip-btn" onClick={() => { if (sure) { onResetStats(); setSure(false); } else setSure(true); }}>{sure ? t.trResetSure : t.trReset}</button>
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- питання
export interface QuestionViewProps {
  q: Question; index: number; total: number; crop: Crop; lang: Lang; t: Dict;
  /** Обраний варіант, якщо на питання вже відповіли. */
  choice: number | null; onChoose: (opt: number) => void; onNext: () => void; onStop: () => void;
  onOpenAtlas?: (code: number) => void; isLast: boolean;
  /** Фото для питання режиму «фото» і base застосунку (для URL файлу). */
  photo?: Photo; photoBase?: string;
}
export function QuestionView({ q, index, total, crop, lang, t, choice, onChoose, onNext, onStop, onOpenAtlas, isLast, photo, photoBase = './' }: QuestionViewProps) {
  const [fig, setFig] = useState<'plant' | 'stem'>('plant');
  const headRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const fbRef = useRef<HTMLElement>(null);
  const model = plantModel(q.code);
  const answered = choice !== null;

  useEffect(() => { if (typeof window.scrollTo === 'function') window.scrollTo(0, 0); headRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (!answered) return;
    nextRef.current?.focus({ preventScroll: true });
    fbRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [answered]);
  useEffect(() => {
    if (answered) return;
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= q.options.length) { e.preventDefault(); onChoose(q.options[n - 1]); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [answered, q, onChoose]);

  const shown = stageByCode(crop, q.code);
  const ok = choice === q.correct;
  const chosenStage = answered && !ok && q.level !== 'principal' ? stageByCode(crop, choice) : undefined;
  const confused = !ok && shown && chosenStage && ((shown.confusableWith ?? []).includes(chosenStage.code) || (chosenStage.confusableWith ?? []).includes(shown.code));
  const state = (opt: number): string => (!answered ? 'idle' : opt === q.correct ? 'correct' : opt === choice ? 'wrong' : 'dim');

  return (
    <div className="tr-grid">
      <section className="card tr-figs">
        {q.visual === 'photo' && photo ? (
          <figure className="tr-photo">
            <img src={photoUrl(photo.file, photoBase)} alt={t.trPhotoAlt} />
            <figcaption>
              {fill(t.trPhotoCredit, { credit: photo.attribution })}
              {answered && <> · <a href={photo.source} target="_blank" rel="noopener noreferrer">{t.trPhotoSource}</a></>}
            </figcaption>
          </figure>
        ) : (<>
        {q.section && (
          <div className="tr-seg" role="group" aria-label={t.trFigHint}>
            <button aria-pressed={fig === 'plant'} onClick={() => setFig('plant')}>{t.trFigPlant}</button>
            <button aria-pressed={fig === 'stem'} onClick={() => setFig('stem')}>{t.trFigStem}</button>
          </div>
        )}
        <div className="tr-fig" hidden={fig !== 'plant'}>
          <div className="plant-wrap tr-plant"><WheatPlant model={model} label={t.trPlantAlt} soilLabel={t.tlSoil} /></div>
        </div>
        {q.section && <div className="tr-fig" hidden={fig !== 'stem'}><StemSection model={model} lang={lang} quiz /></div>}
        {q.section && <p className="note">{t.trFigHint}</p>}
        </>)}
      </section>

      <div className="tr-side">
        <section className="card">
          <p className="tr-progress"><span>{fill(t.trQ, { i: index + 1, n: total })}</span><progress max={total} value={index + (answered ? 1 : 0)} aria-label={fill(t.trQ, { i: index + 1, n: total })} /></p>
          <h2 ref={headRef} tabIndex={-1}>{t[ASK[q.level]]}</h2>
          <div className="tr-opts" role="group" aria-label={t[ASK[q.level]]}>
            {q.options.map((opt, i) => (
              <button key={opt} className="tr-opt" data-state={state(opt)} disabled={answered} onClick={() => onChoose(opt)}>
                <kbd aria-hidden="true">{i + 1}</kbd><span>{optionLabel(q.level, opt, crop, lang, t)}</span>
              </button>
            ))}
          </div>
          {!answered && <p className="note">{fill(t.trKeys, { n: q.options.length })}</p>}
        </section>

        {answered && shown && (
          <section ref={fbRef} className="card tr-feedback" data-ok={ok} aria-live="polite">
            <h3>{ok ? t.trOk : t.trNo}</h3>
            {!ok && <p>{t.trChose}: <b>{optionLabel(q.level, choice, crop, lang, t)}</b></p>}
            <p>{t.trAnswer}: <b>{optionLabel(q.level, q.correct, crop, lang, t)}</b></p>
            {q.level === 'principal' && <p className="note">{t.trShown}:</p>}
            {q.level === 'principal' && <StageBlock s={shown} lang={lang} t={t} />}
            {q.level !== 'principal' && <StageBlock s={shown} lang={lang} t={t} />}
            {chosenStage && <div className="tr-chosen"><p className="note">{t.trChose}:</p><StageBlock s={chosenStage} lang={lang} t={t} /></div>}
            {confused && <p className="note">{t.trConfused}</p>}
            <p className="tl-meta">
              {onOpenAtlas && <button className="chip-btn" onClick={() => onOpenAtlas(q.code)}>{t.tlOpenAtlas}</button>}
            </p>
          </section>
        )}

        <p className="tr-actions">
          {answered && <button ref={nextRef} className="primary" onClick={onNext}>{isLast ? t.trFinish : t.trNext}</button>}
          <button className="chip-btn" onClick={onStop}>{t.trStop}</button>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- підсумок
export interface SummaryViewProps {
  summary: Summary; crop: Crop; lang: Lang; t: Dict; level: Level;
  onRetry: () => void; onAgain: () => void; onBack: () => void; onOpenAtlas?: (code: number) => void;
  /** Фото, що були в сесії: для атрибуції. */
  credits?: Photo[];
}
export function SummaryView({ summary: s, crop, lang, t, level, onRetry, onAgain, onBack, onOpenAtlas, credits = [] }: SummaryViewProps) {
  const label = (l: Level, opt: number) => optionLabel(l, opt, crop, lang, t);
  return (
    <section className="card tr-summary">
      <h2>{t.trSummary}</h2>
      <p className="tr-score" data-percent={s.percent}><b>{fill(t.trScore, { c: s.correct, n: s.total, p: s.percent })}</b></p>
      <progress max={s.total || 1} value={s.correct} aria-label={fill(t.trScore, { c: s.correct, n: s.total, p: s.percent })} />
      {s.byPrincipal.length > 0 && (
        <>
          <h3>{t.trByP}</h3>
          <ul className="plain tr-byp">
            {s.byPrincipal.map((p) => <li key={p.principal}><span className="code" data-p={p.principal}>{p.principal}</span> {principalStages[p.principal].name[lang]}: <b>{p.correct}/{p.asked}</b></li>)}
          </ul>
        </>
      )}
      {s.mistakes.length === 0 ? <p className="note">{s.total > 0 ? t.trPerfect : ''}</p> : (
        <>
          <h3>{t.trMist}</h3>
          <ul className="plain tr-mist">
            {s.mistakes.map(({ question: q, choice }) => (
              <li key={q.id}>
                <b>{displayCode(q.code)} · {stageByCode(crop, q.code)?.name[lang]}</b>
                <small>{t.trChose}: {label(q.level, choice)}</small>
                {onOpenAtlas && <button className="chip-btn" onClick={() => onOpenAtlas(q.code)}>{t.tlOpenAtlas}</button>}
              </li>
            ))}
          </ul>
          <h3>{t.trConf}</h3>
          <ul className="plain tr-conf">
            {s.confusions.map((c) => <li key={`${c.kind}${c.a}-${c.b}`}>{label(c.kind === 'principal' ? 'principal' : level, c.a)} ↔ {label(c.kind === 'principal' ? 'principal' : level, c.b)}{c.count > 1 ? ` ×${c.count}` : ''}</li>)}
          </ul>
        </>
      )}
      {credits.length > 0 && (
        <>
          <h3>{t.trCredits}</h3>
          <ul className="plain tr-credits">
            {credits.map((p) => <li key={p.id}>{displayCode(p.code)}: {p.attribution} · <a href={p.source} target="_blank" rel="noopener noreferrer">{t.trPhotoSource}</a></li>)}
          </ul>
        </>
      )}
      <p className="tr-actions">
        {s.mistakes.length > 0 && <button className="primary" onClick={onRetry}>{t.trRetry}</button>}
        <button className={s.mistakes.length ? 'chip-btn' : 'primary'} onClick={onAgain}>{t.trAgain}</button>
        <button className="chip-btn" onClick={onBack}>{t.trBack}</button>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- екран тренажера
interface Run { level: Level; questions: Question[]; answers: Answer[]; index: number; finished: boolean; mode: Visual; photos: Record<string, Photo> }
export interface TrainerViewProps {
  lang: Lang; t: Dict; crop?: Crop; onOpenAtlas?: (code: number) => void;
  /** Генератор зерна сесії (у тестах підставляється детермінований). */
  makeSeed?: () => number;
  /** Колекція фото (за замовчуванням — з маніфесту), base застосунку і завантажувач зображень (у тестах підставляються). */
  photos?: Photo[]; photoBase?: string; loadImage?: (url: string) => Promise<boolean>;
}

/** Тренажер «Впізнай фазу»: налаштування → питання з розбором → підсумок. Статистика по фазах зберігається в браузері. */
export function TrainerView({ lang, t, crop = crops[0], onOpenAtlas, makeSeed = defaultSeed, photos = PHOTOS, photoBase = defaultBase(), loadImage = defaultLoadImage }: TrainerViewProps) {
  const [stats, setStats] = useLocalState<Stats>('bbch.trainer.stats', {}, isStats);
  const [level, setLevel] = useLocalState<Level>('bbch.trainer.level', 'phase', (v) => v === 'principal' || v === 'phase' || v === 'compare');
  const [weak, setWeak] = useLocalState<boolean>('bbch.trainer.weak', false, (v) => typeof v === 'boolean');
  const [mode, setMode] = useLocalState<Visual>('bbch.trainer.mode', 'svg', (v) => v === 'svg' || v === 'photo');
  const [run, setRun] = useState<Run | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoFail, setPhotoFail] = useState(false);
  const weakList = weakCodes(stats);
  const withPhotos = photoCodes(photos, crop.id);

  const begin = async (lv: Level, onlyCodes?: number[], visual: Visual = mode) => {
    const wantPhoto = visual === 'photo' && withPhotos.length > 0;
    const seed = makeSeed();
    let questions = buildSession(crop, { level: lv, seed, stats, weakFocus: !onlyCodes && weak && weakList.length > 0, onlyCodes, length: onlyCodes ? onlyCodes.length : 10, photoCodes: wantPhoto ? withPhotos : undefined });
    setPhotoFail(false);
    if (questions.length === 0) { setRun(null); setEmpty(true); return; }
    let picked: Record<string, Photo> = {};
    if (wantPhoto) {
      // Питання з фото ставимо лише якщо зображення справді завантажилось: SVG-запасу для нього немає (він не розрізняє всі фази).
      setLoading(true);
      const rng = makeRng(seed ^ 0x9e3779b9);
      const withPick = questions.map((q) => ({ q, p: pickPhoto(photos, crop.id, q.code, rng) }));
      const loaded = await Promise.all(withPick.map(async ({ q, p }) => (p && (await loadImage(photoUrl(p.file, photoBase))) ? { q, p } : null)));
      setLoading(false);
      const ok = loaded.filter((x): x is { q: Question; p: Photo } => x !== null);
      if (ok.length === 0) { setRun(null); setEmpty(true); setPhotoFail(true); return; }
      questions = ok.map((x) => x.q);
      picked = Object.fromEntries(ok.map((x) => [x.q.id, x.p]));
    }
    setEmpty(false);
    setRun({ level: lv, questions, answers: [], index: 0, finished: false, mode: wantPhoto ? 'photo' : 'svg', photos: picked });
  };
  const choose = (opt: number) => {
    if (!run || run.answers.length > run.index) return;
    const q = run.questions[run.index];
    const a = check(q, opt);
    setRun({ ...run, answers: [...run.answers, a] });
    setStats((s) => recordAnswer(s, q.code, a.ok));
  };
  const next = () => { if (run) setRun(run.index + 1 >= run.questions.length ? { ...run, finished: true } : { ...run, index: run.index + 1 }); };
  const stop = () => { if (run) setRun(run.answers.length > 0 ? { ...run, finished: true } : null); };

  if (!run) {
    return <SetupView t={t} level={level} onLevel={setLevel} weak={weak} onWeak={setWeak} weakList={weakList} stats={stats} onStart={() => void begin(level)} onResetStats={() => setStats({})} empty={empty}
      mode={mode} onMode={setMode} photoCount={photos.filter((p) => p.crop === crop.id).length} photoPhases={withPhotos.length} loading={loading} photoFail={photoFail} />;
  }
  if (run.finished) {
    const summary = summarize(crop, run.questions, run.answers);
    const mistakeCodes = [...new Set(summary.mistakes.map((m) => m.question.code))];
    return <SummaryView summary={summary} crop={crop} lang={lang} t={t} level={run.level} onRetry={() => void begin(run.level, mistakeCodes, run.mode)} onAgain={() => void begin(run.level, undefined, run.mode)} onBack={() => setRun(null)} onOpenAtlas={onOpenAtlas}
      credits={[...new Map(Object.values(run.photos).map((p) => [p.id, p])).values()]} />;
  }
  const q = run.questions[run.index];
  const answered = run.answers.length > run.index;
  return (
    <QuestionView key={q.id} q={q} index={run.index} total={run.questions.length} crop={crop} lang={lang} t={t}
      choice={answered ? run.answers[run.index].choice : null} onChoose={choose} onNext={next} onStop={stop}
      onOpenAtlas={onOpenAtlas} isLast={run.index + 1 >= run.questions.length} photo={run.photos[q.id]} photoBase={photoBase} />
  );
}
