'use client';
import { supabase } from '../supabase';
import { badges } from './catalog';
import { applyFacts, emptyState, mergeStates, newAwards, uniqueMetrics, metricCap, validFact, type BadgeState, type Fact, type Award } from './engine';
let owner:string|null=null, initialized=false, state=emptyState(), pending:Fact[]=[], revision=0;
let persistenceFailed=false;
let status:'local'|'syncing'|'saved'|'error'='local';
const listeners=new Set<()=>void>();
let notices:Award[]=[];
const key=(id:string|null)=>`10tg-badges-v1:${id??'guest'}`;
const emit=()=>listeners.forEach(fn=>fn());
function persist(){try{(owner?localStorage:sessionStorage).setItem(key(owner),JSON.stringify({state,pending}));persistenceFailed=false;}catch{persistenceFailed=true;}}
export function subscribeBadges(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export function receiveBadgeStorage(storageKey:string|null,value:string|null){
 if(!owner||storageKey!==key(owner)||!value)return;
 try{const saved=JSON.parse(value);const facts=Array.isArray(saved.state?.facts)?saved.state.facts:[];state=applyFacts(state,facts,badges);const queue=new Map(pending.map(f=>[`${f.metric}:${f.subject}`,f]));for(const f of Array.isArray(saved.pending)?saved.pending:[]){if(validFact(f,badges)){const k=`${f.metric}:${f.subject}`;const old=queue.get(k);if(!old||old.value<f.value)queue.set(k,f);}}pending=[...queue.values()];emit();}catch{/* Ignore corrupt or unrelated tab storage. */}
}
export function badgeSnapshot(){return {owner,initialized,state,status,persistenceFailed,notices};}
export function dismissBadge(id:string){notices=notices.filter(a=>a.id!==id);emit();}
function enqueue(awards:Award[]){for(const a of awards)notices=[...notices.filter(n=>n.id!==a.id),a];}
export function setBadgeOwner(id:string|null){
 if(initialized&&owner===id)return;
 owner=id;initialized=true;revision++;notifyAfterSync=false;state=emptyState();pending=[];notices=[];status='local';persistenceFailed=false;
 try{const data=JSON.parse((owner?localStorage:sessionStorage).getItem(key(owner))??'null');if(data){state=applyFacts(emptyState(),Array.isArray(data.state?.facts)?data.state.facts:[],badges);if(Array.isArray(data.state?.awards))state=mergeStates(state,{facts:[],awards:data.state.awards.filter((a:Award)=>a&&typeof a.id==='string'&&typeof a.earnedAt==='string')},badges);pending=Array.isArray(data.pending)?data.pending.filter((f:Fact)=>validFact(f,badges)):[];}}catch{persistenceFailed=true;}
 emit();void syncBadges();
}
export function recordBadgeFacts(facts:Fact[],notify=true){
 if(!initialized)return;
 const next=applyFacts(state,facts,badges);
 const changed=next.facts.filter(f=>!state.facts.some(old=>old.metric===f.metric&&old.subject===f.subject&&old.value>=f.value));
 if(!changed.length)return;
 if(notify||notifyAfterSync)enqueue(newAwards(state,next));state=next;
 const map=new Map(pending.map(f=>[`${f.metric}:${f.subject}`,f]));for(const f of changed)map.set(`${f.metric}:${f.subject}`,f);pending=[...map.values()];
 persist();emit();void syncBadges();
}
export function badgeFact(metric:string,value=1,subject='best'):Fact{return {metric,value:Math.min(value,uniqueMetrics.has(metric)?1:metricCap(metric,badges)),subject};}
// Streaks are scoped to this tab and account; failures survive reloads.
export function badgeStreak(game:string,correct:boolean){let count=0;const k=`${key(owner)}:streak:${game}`;try{count=Number(sessionStorage.getItem(k))||0;count=correct?count+1:0;sessionStorage.setItem(k,String(count));}catch{count=correct?1:0;}return count;}
let syncingRevision:number|null=null;
let notifyAfterSync=false;
export async function syncBadges(notify=false){
 if(!owner||!supabase)return;
 if(syncingRevision===revision){if(notify)notifyAfterSync=true;return;}
 const turn=revision, account=owner;syncingRevision=turn;status='syncing';emit();
 try{
  // Batches are atomic and idempotent, including retries after a lost response.
  do {
   const batch=pending.slice(0,100);
   const {data,error}=await supabase.rpc('sync_own_badges',{p_facts:batch});
   if(turn!==revision||account!==owner)return;
   if(error||!data||!Array.isArray(data.facts)||!Array.isArray(data.awards))throw new Error('badge_sync');
   const next=mergeStates(state,data as BadgeState,badges);if(notify||notifyAfterSync)enqueue(newAwards(state,next));state=next;
   pending=pending.filter(f=>!batch.some(b=>b.metric===f.metric&&b.subject===f.subject&&b.value>=f.value));
   persist();
  }while(pending.length);
  status='saved';
 }catch{if(turn===revision)status='error';}
 finally{if(syncingRevision===turn)syncingRevision=null;if(turn===revision){emit();if(notifyAfterSync){notifyAfterSync=false;void syncBadges(true);}}}
}
