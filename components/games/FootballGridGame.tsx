'use client';

import Link from 'next/link';
import {syncBadges} from "../../lib/badges/client";
import { playerDisplayName } from '../../lib/football/player-identity';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../I18nProvider';
import { translatedCountry } from '../../lib/football/country-i18n';
import { RULES, availablePoints, formatResolution, searchPlayers, type Axis, type Catalog, type Difficulty, type GridState, type Position } from '../../lib/football-grid/engine';
import { gridCopy, positionCopy } from '../../lib/football-grid/copy';
import catalogData from '../../data/football-grid/catalog.json';
import './FootballGridGame.css';

function namedCatalog(catalog: Catalog): Catalog {
  return { ...catalog, players: catalog.players.map(player => ({ ...player, name: playerDisplayName(player.id, player.name), aliases: [...new Set([...player.aliases, player.name])] })) };
}
const bundled = namedCatalog(catalogData as Catalog);
const localFlags: Record<string,string> = {Argentina:'ar',Belgium:'be',Brazil:'br',Chile:'cl',Colombia:'co',Denmark:'dk',Ecuador:'ec',England:'gb-eng',France:'fr',Germany:'de',Italy:'it',Netherlands:'nl',Nigeria:'ng',Paraguay:'py',Portugal:'pt',Spain:'es',Switzerland:'ch',Uruguay:'uy'};

export default function FootballGridGame() {
  const { locale } = useI18n(), t = gridCopy[locale];
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [states, setStates] = useState<Partial<Record<Difficulty,GridState>>>({});
  const [catalog, setCatalog] = useState<Catalog>(bundled);
  const [choosing, setChoosing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const seconds = Math.ceil(remainingMs / 1000);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [option, setOption] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null);
  const lock = useRef(false), deadline = useRef(0), generation = useRef(0), expiryRetry = useRef(0);
  const cellButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const state = states[difficulty], round = state?.round;
  const active = round?.status === 'active';
  const playersById = useMemo(() => new Map(catalog.players.map(p=>[p.id,p])),[catalog]);
  const suggestions = useMemo(() => searchPlayers(catalog.players, query, round?.answers ?? []),[catalog,query,round?.answers]);

  function axisName(axis: Axis) {
    return axis.kind === 'country' ? translatedCountry(axis.name,locale) : axis.kind === 'position' ? positionCopy[locale][axis.id as Position] : axis.name;
  }
  function axisVisual(axis: Axis) {
    if (axis.kind === 'club') return <img src={axis.image} alt="" width={42} height={42} />;
    if (axis.kind === 'country') return localFlags[axis.name] || axis.image ? <img className="fg-flag" src={localFlags[axis.name]?`/flags/${localFlags[axis.name]}.svg`:axis.image} alt="" width={36} height={24} /> : <span className="fg-flag-emoji" aria-hidden="true">{axis.flag}</span>;
    return <svg className="fg-pitch" viewBox="0 0 40 48" aria-hidden="true"><rect x="2" y="2" width="36" height="44" rx="2"/><path d="M2 24h36M12 2v8h16V2M12 46v-8h16v8"/><circle cx="20" cy="24" r="6"/><circle className="fg-position-dot" cx="20" cy={{Goalkeeper:41,Defender:33,Midfielder:24,Attacker:12}[axis.id] ?? 24} r="4"/></svg>;
  }
  async function rpc(mode: Difficulty, action = 'state', extra: Record<string,unknown> = {}) {
    if (!supabase) throw new Error('unavailable');
    const requested = performance.now();
    const {data,error:rpcError} = await supabase.rpc('football_grid_play',{p_action:action,p_difficulty:mode,...extra});
    if (rpcError || !data) throw new Error('unavailable');
    const value = data as GridState;
    return {value, remaining: value.round ? Math.max(0,Date.parse(value.round.expires_at)-Date.parse(value.server_now)-(performance.now()-requested)) : 0};
  }
  async function ensureCatalog(version?: string) {
    if (!version || version === catalog.version) return;
    if (version === bundled.version) { setCatalog(bundled); return; }
    const {data,error:catalogError} = await supabase!.from('football_grid_catalogs').select('payload').eq('version',version).single();
    if (catalogError || !data?.payload) throw new Error('catalog_unavailable');
    setCatalog(namedCatalog(data.payload as Catalog));
  }
  async function refresh(mode = difficulty, showRound = false) {
    if (lock.current || !user) return;
    lock.current = true; setBusy(true);
    const turn = generation.current;
    try {
      const replies = await Promise.all([rpc('easy'),rpc('hard')]);
      const reply = replies[mode==='easy'?0:1];
      if (turn !== generation.current) return;
      await ensureCatalog(reply.value.round?.catalog_version);
      if (turn !== generation.current) return;
      setStates({easy:replies[0].value,hard:replies[1].value}); deadline.current=performance.now()+reply.remaining;
      setRemainingMs(reply.remaining); setError(false);
      if (showRound && reply.value.round) setChoosing(false);
    } catch { if (turn===generation.current) setError(true); }
    finally { if (turn===generation.current) {lock.current=false;setBusy(false);} }
  }
  useEffect(()=>{
    if (!supabase) {setUser(null);return;}
    let alive=true;
    supabase.auth.getSession().then(({data,error:authError})=>{if(alive){setUser(data.session?.user.id??null);if(authError)setError(true);}});
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user.id??null);});
    return()=>{alive=false;data.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    const turn=++generation.current; lock.current=false;setBusy(false);setStates({});setSelected(null);setConfirming(false);setChoosing(true);
    if (!user) return;
    let mode:Difficulty='easy';
    try {if(sessionStorage.getItem(`10tg-grid-mode:${user}`)==='hard')mode='hard';}catch{}
    setDifficulty(mode);setBusy(true);lock.current=true;
    Promise.all([rpc('easy'),rpc('hard')]).then(async replies=>{
      if(generation.current!==turn)return;
      const reply=replies[mode==='easy'?0:1];
      await ensureCatalog(reply.value.round?.catalog_version);
      if(generation.current!==turn)return;
      setStates({easy:replies[0].value,hard:replies[1].value});deadline.current=performance.now()+reply.remaining;
      setRemainingMs(reply.remaining);setChoosing(!reply.value.round);setError(false);
    }).catch(()=>{if(generation.current===turn)setError(true);}).finally(()=>{if(generation.current===turn){lock.current=false;setBusy(false);}});
    return()=>{generation.current++;};
    // Account changes invalidate every pending response and restore only that account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user]);
  useEffect(()=>{
    if(!user)return;
    const tick=setInterval(()=>{
      if(active){
        const left=Math.max(0,deadline.current-performance.now());setRemainingMs(left);
        if(left===0 && performance.now()-expiryRetry.current>5000){expiryRetry.current=performance.now();void refresh();}
      }
    },250);
    const sync=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},5000);
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(tick);clearInterval(sync);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user,difficulty,active,round?.id]);
  useEffect(()=>{
    if(!active){setSelected(null);setConfirming(false);}
  },[active]);
  useEffect(()=>{
    if(selected!==null || confirming){if(!dialog.current?.open)dialog.current?.showModal();if(!confirming)input.current?.focus();}
    else dialog.current?.close();
  },[selected,confirming]);
  async function act(action:string, mode=difficulty, extra:Record<string,unknown>={}) {
    if(lock.current || !user)return;
    const turn=generation.current;lock.current=true;setBusy(true);setFeedback('');
    try {
      const reply=await rpc(mode,action,{...(action==='start'?{}:{p_round:round?.id}),...extra});
      if(turn!==generation.current)return;
      await ensureCatalog(reply.value.round?.catalog_version);
      if(turn!==generation.current)return;
      setStates(s=>({...s,[mode]:reply.value}));setDifficulty(mode);deadline.current=performance.now()+reply.remaining;
      setRemainingMs(reply.remaining);setError(false);setChoosing(false);
      try{sessionStorage.setItem(`10tg-grid-mode:${user}`,mode);}catch{}
      setFeedback(reply.value.feedback??'');
      if(reply.value.round?.status==='won')void syncBadges(true);
      if(action==='clear'){setQuery('');input.current?.focus();}
      else if(reply.value.feedback==='correct' || action==='surrender'){closeDialog();}
    }catch{if(turn===generation.current)setError(true);}
    finally{if(turn===generation.current){lock.current=false;setBusy(false);}}
  }
  function closeDialog(){const cell=selected;setSelected(null);setConfirming(false);setQuery('');setOption(0);if(cell!==null)cellButtons.current[cell]?.focus();}
  const feedbackText = feedback==='correct'?t.correct:feedback==='incorrect'?t.incorrect:feedback==='duplicate'?t.duplicate:feedback==='filled'?t.filledMessage:feedback==='daily_limit'?t.limit:'';
  const variant = round?.board.variant==='country-club'?t.countryClub:round?.board.variant==='country-position'?t.countryPosition:t.clubClub;
  const solved = round?.answers.filter(id=>id!==null).length??0;
  const selectedPlayer = selected!==null && round?.answers[selected] ? playersById.get(round.answers[selected]!) : null;
  const formatPoints=(n:number)=>new Intl.NumberFormat(locale).format(n);
  const potential=active ? (round.rules_version===2 ? availablePoints(difficulty,remainingMs) : (difficulty==='easy'?100:200)) : Math.max(0,round?.score??0);
  const bestStreak=Math.max(states.easy?.stats.best_streak??0,states.hard?.stats.best_streak??0);
  const fastest=Math.min(states.easy?.stats.best_time_ms??Infinity,states.hard?.stats.best_time_ms??Infinity);
  const easyWins=states.easy?.stats.wins??0,hardWins=states.hard?.stats.wins??0;
  const achievements:[boolean,string][]=[[easyWins>0,t.achievementEasy],[hardWins>0,t.achievementHard],[easyWins>0&&hardWins>0,t.achievementBoth],[easyWins+hardWins>=10,t.achievementTen],[bestStreak>=3,t.achievementStreak],[fastest<=300000,t.achievementFast]];

  return <div className="football-grid">
    {error && <div className="fg-notice" role="alert"><p>{round?t.error:t.unavailable}</p><button className="fg-secondary" disabled={busy} onClick={()=>void refresh()}>{t.retry}</button></div>}
    {user===undefined || (user&&!state&&!error) ? <p className="fg-panel" role="status">{t.loading}</p> : !user ? <section className="fg-panel fg-login"><span className="fg-kicker">FOOTBALL GRID · 4 × 4</span><h2>{t.login}</h2><p>{supabase?t.loginText:t.unavailable}</p><Link className="fg-primary" href={`/${locale}/usuario`}>{t.login} ↗</Link></section> : choosing || !round ? <section className="fg-panel fg-intro"><span className="fg-kicker">16 / 16 · FOOTBALL GRID</span><h2>{t.choose}</h2>{state?.rules_version!==2&&<p role="status">{t.updateRequired}</p>}<div className="fg-modes">{(['easy','hard'] as const).map((mode,i)=>{
      const s=states[mode],inProgress=s?.round?.status==='active',limited=(s?.used??0)>=3&&!inProgress;
      return <article className="fg-mode" key={mode}><div className="fg-mode-number" aria-hidden="true">0{i+1}<span>4 × 4</span></div><h3>{t[mode]}</h3><p>{mode==='easy'?t.easyText:t.hardText}</p><div className="fg-mode-facts"><span>{t.maxTime}</span><strong>{formatPoints(RULES[mode].reward)} {t.points}</strong></div><p className="fg-fine">{t.penalty}: −{RULES[mode].surrender} · {t.daily}: {s?.used??0}/3</p><button className="fg-primary" disabled={busy||limited||!s||error||s.rules_version!==2} onClick={()=>void act('start',mode)}>{inProgress?t.resume:limited?t.limit:t.start} <span aria-hidden="true">↗</span></button></article>;
    })}</div><p className="fg-fine">{t.reset}</p></section> : <section className="fg-panel fg-play">
      <div className="fg-play-heading"><div><span className="fg-kicker">{t[difficulty]} · 4 × 4</span><h2>{variant}</h2></div><button className="fg-text" disabled={busy} onClick={()=>{setChoosing(true);setFeedback('');}}>{t.modes}</button></div>
      <div className="fg-scoreboard"><div className={active&&seconds<=10?'fg-time is-urgent':'fg-time'}><span>{t.available}</span><strong aria-label={t.available} aria-live="off">{formatPoints(potential)}</strong></div><div><span>{t.filled}</span><strong>{solved}<small> / 16</small></strong></div><div><span>{t.daily}</span><strong>{state?.used??0}<small> / 3</small></strong></div><div><span>{t.total}</span><strong>{state?.stats.points??0}</strong></div></div>
      {active&&round.rules_version!==2&&<p className="fg-fine">{t.legacyRound}</p>}{!active&&<div className={`fg-summary ${round.status==='won'?'is-win':''}`} role="status"><span>{t.summary}</span><h3>{round.status==='won'?t.complete:round.status==='timeout'?t.expired:t.surrendered}</h3><strong>{round.score>0?'+':''}{formatPoints(round.score)} {t.points}</strong>{round.status==='won'&&<p>{t.resolution}: {formatResolution(round.elapsed_ms)} · {t.currentStreak}: {round.streak_after??0}</p>}<button className="fg-primary" disabled={busy||(state?.used??0)>=3} onClick={()=>void act('start')}>{(state?.used??0)>=3?t.limit:t.again}</button></div>}
      <table className="fg-board"><caption className="fg-sr">Football Grid: {variant}. {t.rulesText}</caption><thead><tr><td className="fg-corner" aria-hidden="true"><span>10<br/>TG</span></td>{round.board.columns.map(a=><th scope="col" key={a.kind+a.id}><div className="fg-axis">{axisVisual(a)}<span>{axisName(a)}</span></div></th>)}</tr></thead><tbody>{round.board.rows.map((a,rowIndex)=><tr key={a.kind+a.id}><th scope="row"><div className="fg-axis">{axisVisual(a)}<span>{axisName(a)}</span></div></th>{round.board.columns.map((b,colIndex)=>{
        const i=rowIndex*4+colIndex,p=playersById.get(round.answers[i]??0);
        return <td key={b.kind+b.id}><button className={`fg-cell ${p?'is-solved':''}`} ref={el=>{cellButtons.current[i]=el;}} disabled={!active||seconds===0||busy||error} aria-label={`${t.cell} ${rowIndex+1}, ${colIndex+1}: ${axisName(a)} × ${axisName(b)}${p?`. ${p.name}. ${t.change}`:''}`} onClick={()=>{setSelected(i);setQuery('');setFeedback('');setOption(0);}}>{p?<><img src={p.photo} alt="" width={80} height={80} onError={e=>{e.currentTarget.style.visibility='hidden';}}/><span>{p.name}</span><b aria-hidden="true">✓</b></>:<span className="fg-cell-plus" aria-hidden="true">+</span>}</button></td>;
      })}</tr>)}</tbody></table>
      <div className="fg-underboard"><p role="status" aria-live="polite">{seconds>0&&seconds<=10&&active?t.warning:feedbackText}</p>{active&&<button className="fg-text fg-surrender" disabled={busy||seconds===0} onClick={()=>{setConfirming(true);setSelected(null);}}>{t.surrender} · −{RULES[difficulty].surrender}</button>}</div>
      <p className="fg-fine">{t.editRule}</p>
    </section>}
    <section className="fg-rules"><h2>{t.rules}</h2><div className="fg-rule-scores"><div><strong>{t.easy}</strong><span>{formatPoints(RULES.easy.reward)} → 0 · {t.maxTime}</span></div><div><strong>{t.hard}</strong><span>{formatPoints(RULES.hard.reward)} → 0 · {t.maxTime}</span></div></div><p>{t.scoring}</p><details><summary>{t.rules}</summary><p>{t.rulesText}</p><p>{t.quota}</p><p>{t.recordRules}</p><p>{t.editRule}</p></details><p className="fg-fine">{t.reset}</p><details><summary>{catalog.players.length} {t.catalog}</summary><p>{t.data}</p><p>{new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(catalog.exportedAt))} · {catalog.version}</p></details></section>
    {user&&<section className="fg-records"><h2>{t[difficulty]} · {t.history}</h2><div className="fg-record-facts"><div><span>{t.currentStreak}</span><strong>{state?.stats.current_streak??0}</strong></div><div><span>{t.bestStreak}</span><strong>{state?.stats.best_streak??0}</strong></div><div><span>{t.bestTime}</span><strong>{formatResolution(state?.stats.best_time_ms)}</strong></div></div>{!state?.history?.length?<p>{t.historyEmpty}</p>:<ol className="fg-history">{state.history.map(h=><li key={h.id}><span>{new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(h.finished_at))}<small>{h.status==='won'?t.complete:h.status==='timeout'?t.expired:t.surrendered}</small></span><span>{h.score>0?'+':''}{formatPoints(h.score)} {t.points}<small>{t.currentStreak}: {h.streak_after??0}{h.status==='won'?' · '+formatResolution(h.elapsed_ms):''}</small></span></li>)}</ol>}</section>}
    {user&&<section className="fg-achievements"><h2>{t.achievements}</h2><div>{achievements.map(([earned,label])=><article key={label} className={earned?'is-earned':''}><b aria-hidden="true">{earned?'✓':'◇'}</b><span>{label}<small>{earned?t.earned:t.pending}</small></span></article>)}</div></section>}
    <dialog className="fg-dialog" ref={dialog} onCancel={e=>{e.preventDefault();closeDialog();}} aria-labelledby="fg-dialog-title">
      <div className="fg-dialog-top"><h2 id="fg-dialog-title">{confirming?t.surrender:t.search}</h2><button className="fg-close" onClick={closeDialog} aria-label={t.close}>×</button></div>
      {confirming?<><p>{t.surrenderConfirm}</p><strong>−{RULES[difficulty].surrender} {t.points}</strong><div className="fg-dialog-actions"><button className="fg-secondary" onClick={closeDialog}>{t.cancel}</button><button className="fg-primary" disabled={busy||seconds===0} onClick={()=>void act('surrender')}>{t.confirm}</button></div></>:selected!==null&&round?<>
        <p className="fg-search-criteria">{axisName(round.board.rows[Math.floor(selected/4)])} <span>×</span> {axisName(round.board.columns[selected%4])}</p>
        {selectedPlayer?<div className="fg-selected-player"><img src={selectedPlayer.photo} alt="" width={72} height={72}/><strong>{selectedPlayer.name}</strong><button className="fg-secondary" disabled={busy||seconds===0} onClick={()=>void act('clear',difficulty,{p_cell:selected})}>{t.change}</button></div>:<>
          <label className="fg-sr" htmlFor="fg-search">{t.search}</label><input id="fg-search" ref={input} value={query} onChange={e=>{setQuery(e.target.value);setOption(0);setFeedback('');}} placeholder={t.search} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length>0} aria-controls="fg-options" aria-activedescendant={suggestions[option]?`fg-option-${suggestions[option].id}`:undefined} aria-describedby="fg-search-help" onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOption(i=>Math.min(suggestions.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setOption(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&suggestions[option]){e.preventDefault();void act('answer',difficulty,{p_cell:selected,p_player:suggestions[option].id});}}}/>
          <p id="fg-search-help" className="fg-fine">{t.searchHint}</p><div className="fg-options" id="fg-options" role="listbox" aria-label={t.search}>{suggestions.map((p,i)=><button type="button" id={`fg-option-${p.id}`} role="option" aria-selected={option===i} key={p.id} disabled={busy||seconds===0} onClick={()=>void act('answer',difficulty,{p_cell:selected,p_player:p.id})}><img src={p.photo} alt="" width={40} height={40}/><span>{p.name}</span><span aria-hidden="true">↗</span></button>)}</div>{query.trim()&&!suggestions.length&&<p role="status">{t.empty}</p>}
        </>}
        <p className="fg-search-feedback" role="status" aria-live="polite">{error?t.error:feedbackText}</p>
      </>:null}
    </dialog>
  </div>;
}
