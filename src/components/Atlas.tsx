import { useEffect, useRef, useState } from 'react';
import type { Dict } from '../i18n';
import type { Crop, Lang, Stage, Verification } from '../types';
import { crops } from '../data/crops';
import { principalStages } from '../data/principalStages';
import { references } from '../data/references';
import { displayCode, nearestStage, searchStages, stageByCode, stagesOfPrincipal } from '../engine/scale';

const VERIF: Record<Verification, keyof Dict> = { 'cross-checked': 'crossChecked', authored: 'authored', unverified: 'unverified' };

function StageCard({ s, crop, lang, t, open, onToggle, onJump, onShowOnPlant }: { s: Stage; crop: Crop; lang: Lang; t: Dict; open: boolean; onToggle: () => void; onJump: (c: number) => void; onShowOnPlant?: (c: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [open]);
  return (
    <article ref={ref} className={`stage${open ? ' open' : ''}`} id={`stage-${s.code}`}>
      <button className="stage-head" aria-expanded={open} onClick={onToggle}>
        <span className="code" data-p={s.principal}>{displayCode(s.code)}</span>
        <span className="stage-title"><b>{s.name[lang]}</b>{s.traditional && <small>{s.traditional[lang]}</small>}</span>
        <span className="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="stage-body">
          <p>{s.description[lang]}</p>
          {s.howToCheck && <div className="tip"><b>{t.howto}</b><p>{s.howToCheck[lang]}</p><small>{t.authored}</small></div>}
          {s.confusableWith && s.confusableWith.length > 0 && (
            <p className="conf"><b>{t.confusable}: </b>{s.confusableWith.map((c) => { const o = stageByCode(crop, c); return o ? <button key={c} className="chip-btn" onClick={() => onJump(c)}>{displayCode(c)} · {o.name[lang]}</button> : null; })}</p>
          )}
          <p className="stage-actions">
            <span className={`badge v-${s.verification}`}>{t[VERIF[s.verification]]}</span>
            {onShowOnPlant && <button className="chip-btn" onClick={() => onShowOnPlant(s.code)}>{t.showOnPlant}</button>}
          </p>
        </div>
      )}
    </article>
  );
}

/** Атлас фаз: вибір культури → головна стадія → фази з визначеннями, методикою перевірки й порівнянням сусідніх фаз. */
export function Atlas({ lang, t, initialCode, onShowOnPlant }: { lang: Lang; t: Dict; initialCode?: number; onShowOnPlant?: (code: number) => void }) {
  const [cropId, setCropId] = useState('winter-wheat');
  const crop = crops.find((c) => c.id === cropId) ?? crops[0];
  const start = initialCode === undefined ? undefined : stageByCode(crops[0], initialCode);
  const [principal, setPrincipal] = useState(start?.principal ?? 3);
  const [open, setOpen] = useState<number | null>(start?.code ?? null);
  const [query, setQuery] = useState('');
  const found = searchStages(crop, query, lang);
  const list = query.trim() ? found : stagesOfPrincipal(crop, principal);
  const miss = /^\d{1,2}$/.test(query.trim()) && found.length === 0 ? nearestStage(crop, Number(query)) : undefined;
  const jump = (code: number) => { const s = stageByCode(crop, code); if (s) { setQuery(''); setPrincipal(s.principal); setOpen(code); } };

  return (
    <>
      <section className="card">
        <h2>{t.crop}</h2>
        <div className="crops">
          {crops.map((c) => (
            <button key={c.id} className={`crop${c.id === cropId ? ' sel' : ''}`} disabled={!c.available} aria-pressed={c.id === cropId} onClick={() => { setCropId(c.id); setOpen(null); }}>
              <b>{c.name[lang]}</b><small>{c.latin}</small>{!c.available && <em>{t.soon}</em>}
            </button>
          ))}
        </div>
        <p className="note"><b>{t.ukraine}.</b> {crop.ukraineNote[lang]}</p>
      </section>

      <section className="card">
        <div className="ribbon" role="tablist" aria-label={t.principal}>
          {principalStages.map((p) => {
            const has = stagesOfPrincipal(crop, p.id).length > 0;
            return <button key={p.id} role="tab" data-p={p.id} aria-selected={principal === p.id && !query} disabled={!has} onClick={() => { setPrincipal(p.id); setQuery(''); setOpen(null); }}><b>{p.id}</b></button>;
          })}
        </div>
        <h3 className="pname">{t.principal} {principal}: {principalStages[principal].name[lang]}</h3>
        <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} />
        {miss && <p className="note">{t.noCode} <button className="chip-btn" onClick={() => jump(miss.code)}>{displayCode(miss.code)} · {miss.name[lang]}</button></p>}
        <div className="stages">
          {list.map((s) => <StageCard key={s.code} s={s} crop={crop} lang={lang} t={t} open={open === s.code} onToggle={() => setOpen(open === s.code ? null : s.code)} onJump={jump} onShowOnPlant={crop.id === 'winter-wheat' ? onShowOnPlant : undefined} />)}
        </div>
      </section>

      <section className="card">
        <h3>{t.sources}</h3>
        <ol className="plain">{references.map((r) => <li key={r.id}><span className={`badge ${r.status === 'todo' ? 'v-unverified' : 'v-cross-checked'}`}>{r.status}</span> {r.citation}{r.license ? ` (${r.license})` : ''}{r.url && <> <a href={r.url} target="_blank" rel="noreferrer">↗</a></>}</li>)}</ol>
        <p className="note">{t.attribution}</p>
        <p className="note">{t.note}</p>
      </section>
    </>
  );
}
