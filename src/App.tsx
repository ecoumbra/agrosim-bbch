import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { getDict } from './i18n';
import type { Lang } from './types';
import { useLocalState } from './hooks/useLocalState';
import { crops } from './data/crops';
import { Atlas } from './components/Atlas';
import { TimelineView } from './components/TimelineView';
import { TrainerView } from './components/TrainerView';
import { FieldView } from './components/FieldView';

type Tab = 'atlas' | 'timeline' | 'trainer' | 'field';

export default function App() {
  const [lang, setLang] = useLocalState<Lang>('bbch.lang', 'uk', (v) => v === 'uk' || v === 'en');
  const [tab, setTab] = useState<Tab>('atlas');
  // Поточна фаза на лінії розвитку зберігається між візитами; код, якого немає в шкалі, відкидається.
  const [timelineCode, setTimelineCode] = useLocalState<number>('bbch.timelineCode', 0, (v) => typeof v === 'number' && crops[0].stages.some((s) => s.code === v));
  const [atlasFocus, setAtlasFocus] = useState<number | undefined>(undefined);
  const t = getDict(lang);
  const tabs: [Tab, string, boolean][] = [['atlas', t.atlas, true], ['timeline', t.timeline, true], ['trainer', t.trainer, true], ['field', t.field, true]];
  const toTop = () => { if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0); };
  const openTab = (k: Tab) => { setAtlasFocus(undefined); setTab(k); };
  const showOnPlant = (code: number) => { setTimelineCode(code); setTab('timeline'); toTop(); };
  const openInAtlas = (code: number) => { setAtlasFocus(code); setTab('atlas'); toTop(); };
  return (
    <>
      <header className="top">
        <div className="titles">
          <p className="t1">{t.tagline}</p>
          <h1><Sprout className="h1-ico" size={22} aria-hidden="true" /><span>{t.title}</span></h1>
          <p className="t3">{t.course}</p>
        </div>
        <div className="tools"><button onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')} aria-label="Language">{lang === 'uk' ? 'UA' : 'EN'}</button></div>
      </header>
      <nav role="tablist">
        {tabs.map(([k, l, on]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => openTab(k)}>{l}{!on && <em> · {t.soon}</em>}</button>)}
      </nav>
      <main>
        {tab === 'atlas' ? <Atlas key={atlasFocus ?? 'free'} lang={lang} t={t} initialCode={atlasFocus} onShowOnPlant={showOnPlant} />
          : tab === 'timeline' ? <TimelineView lang={lang} t={t} code={timelineCode} onCode={setTimelineCode} onOpenAtlas={openInAtlas} />
          : tab === 'trainer' ? <TrainerView lang={lang} t={t} onOpenAtlas={openInAtlas} />
          : <FieldView lang={lang} t={t} onOpenAtlas={openInAtlas} />}
      </main>
      <footer><p>{t.footer1}</p><p>{t.footer2}</p></footer>
    </>
  );
}
