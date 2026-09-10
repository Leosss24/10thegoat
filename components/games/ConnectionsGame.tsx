"use client";
import {useEffect,useMemo,useState} from "react";
import {useI18n} from "../I18nProvider";
import {connectionPuzzles,connectionsCopy} from "../../lib/connections/data";
import {recordGameResult} from "../../lib/game-scores";
import "./ConnectionsGame.css";

type State={version:1;puzzleId:string;order:string[];selected:string[];solved:string[];mistakes:number;finished:boolean;recorded:boolean};
const KEY="10tg-game-session-v1:conexiones";
const puzzle=connectionPuzzles[0];
const allMembers=puzzle.groups.flatMap(group=>group.members);
const shuffle=<T,>(items:T[])=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out};
const fresh=():State=>({version:1,puzzleId:puzzle.id,order:shuffle(allMembers.map(x=>x.id)),selected:[],solved:[],mistakes:4,finished:false,recorded:false});
const valid=(x:unknown):x is State=>{if(!x||typeof x!=="object")return false;const s=x as State;const ids=allMembers.map(m=>m.id);return s.version===1&&s.puzzleId===puzzle.id&&Array.isArray(s.order)&&s.order.length===16&&new Set(s.order).size===16&&s.order.every(id=>ids.includes(id))&&Array.isArray(s.selected)&&s.selected.length<=4&&s.selected.every(id=>ids.includes(id))&&Array.isArray(s.solved)&&s.solved.every(id=>puzzle.groups.some(g=>g.id===id))&&Number.isInteger(s.mistakes)&&s.mistakes>=0&&s.mistakes<=4&&typeof s.finished==="boolean"&&typeof s.recorded==="boolean"};

export default function ConnectionsGame(){
 const {locale}=useI18n();const t=connectionsCopy[locale];const [state,setState]=useState<State|null>(null);const [message,setMessage]=useState("");const [storageFailed,setStorageFailed]=useState(false);
 useEffect(()=>{try{const raw=sessionStorage.getItem(KEY);const parsed=raw?JSON.parse(raw):null;setState(valid(parsed?.value)?parsed.value:fresh())}catch{setState(fresh());setStorageFailed(true)}},[]);
 function save(next:State){setState(next);try{sessionStorage.setItem(KEY,JSON.stringify({version:1,value:next}))}catch{setStorageFailed(true)}}
 const remaining=useMemo(()=>state?state.order.filter(id=>!puzzle.groups.some(g=>state.solved.includes(g.id)&&g.members.some(m=>m.id===id))):[],[state]);
 if(!state)return <div className="connections-panel" role="status">…</div>;
 function toggle(id:string){if(state!.finished)return;const selected=state!.selected.includes(id)?state!.selected.filter(x=>x!==id):state!.selected.length<4?[...state!.selected,id]:state!.selected;save({...state!,selected});setMessage("")}
 function submit(){if(state!.selected.length!==4||state!.finished)return;const group=puzzle.groups.find(g=>g.members.every(m=>state!.selected.includes(m.id)));if(group){const solved=[...state!.solved,group.id];const finished=solved.length===4;const score=finished?Math.max(0,400-(4-state!.mistakes)*50):0;const next={...state!,selected:[],solved,finished,recorded:finished};save(next);setMessage(t.correct);if(finished&&!state!.recorded)recordGameResult("conexiones",{score,won:true})}else{const mistakes=state!.mistakes-1;const finished=mistakes===0;save({...state!,selected:[],mistakes,finished,recorded:finished});setMessage(t.wrong);if(finished&&!state!.recorded)recordGameResult("conexiones",{score:0,won:false})}}
 function restart(){save(fresh());setMessage("")}
 const score=Math.max(0,400-(4-state.mistakes)*50);
 return <div className="connections-game">{storageFailed&&<p className="connections-storage" role="status">{t.storage}</p>}<section className="connections-panel"><header><div><span>10theGOAT · 4×4</span><h2>{state.finished?(state.solved.length===4?t.won:t.lost):t.intro}</h2></div><dl><div><dt>{t.mistakes}</dt><dd>{"●".repeat(state.mistakes)}{"○".repeat(4-state.mistakes)}</dd></div><div><dt>{t.solved}</dt><dd>{state.solved.length}/4</dd></div></dl></header><div className="connections-groups">{puzzle.groups.filter(g=>state.solved.includes(g.id)||(state.finished&&state.solved.length<4)).map(g=><article key={g.id} className={state.solved.includes(g.id)?"is-solved":"is-revealed"}><strong>{g.title[locale]}</strong><span>{g.members.map(m=>m.label).join(" · ")}</span><p>{g.reason[locale]}</p></article>)}</div>{!state.finished&&<div className="connections-grid" role="group" aria-label={t.intro}>{remaining.map(id=>{const item=allMembers.find(x=>x.id===id)!;return <button type="button" aria-pressed={state.selected.includes(id)} className={state.selected.includes(id)?"is-selected":""} onClick={()=>toggle(id)} key={id}>{item.label}</button>})}</div>}<div className="connections-feedback" aria-live="polite">{message}</div>{state.finished?<div className="connections-finish"><strong>{t.points}: {state.solved.length===4?score:0}</strong><button className="btn btn-primary" onClick={restart}>{t.again}</button></div>:<div className="connections-actions"><span>{state.selected.length}/4 {t.selected}</span><button onClick={()=>save({...state,selected:[]})} disabled={!state.selected.length}>{t.clear}</button><button className="btn btn-primary" onClick={submit} disabled={state.selected.length!==4}>{t.submit}</button></div>}</section><details className="connections-rules"><summary>{t.rules}</summary><p>{t.rulesText}</p></details></div>
}
