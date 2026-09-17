// Pure, monotonic progress: repeated facts never add progress twice.
export type Fact = { metric:string; subject:string; value:number };
export type Award = { id:string; earnedAt:string; plenoAt?:string };
export type BadgeState = { facts:Fact[]; awards:Award[] };
export type Rule = { id:string; metric:string; target:number; challengeId?:string };
export const uniqueMetrics = new Set(['players','careers','higher-correct','grids','clubs','odd-rounds','connections','timelines']);
export const emptyState = ():BadgeState=>({facts:[],awards:[]});
export function metricCap(metric:string,rules:Rule[]) {return Math.max(0,...rules.filter(b=>b.metric===metric).map(b=>b.challengeId?25:b.target));}
export function validFact(f:Fact,rules:Rule[]) {return !!f && typeof f.metric==='string' && typeof f.subject==='string' && f.subject.length>0 && f.subject.length<=180 && Number.isInteger(f.value) && f.value>0 && f.value <= (uniqueMetrics.has(f.metric)?1:metricCap(f.metric,rules)) && rules.some(b=>b.metric===f.metric) && (uniqueMetrics.has(f.metric)||f.subject==='best');}
export function progress(state:BadgeState,metric:string) {const facts=state.facts.filter(f=>f.metric===metric);return uniqueMetrics.has(metric)?facts.length:Math.max(0,...facts.map(f=>f.value));}
export function applyFacts(state:BadgeState,incoming:Fact[],rules:Rule[],now=new Date().toISOString()):BadgeState {
 const facts=new Map(state.facts.filter(f=>validFact(f,rules)).map(f=>[`${f.metric}:${f.subject}`,f]));
 for(const f of incoming){if(!validFact(f,rules))continue;const key=`${f.metric}:${f.subject}`,old=facts.get(key);if(!old&&uniqueMetrics.has(f.metric)&&[...facts.values()].filter(x=>x.metric===f.metric).length>=metricCap(f.metric,rules))continue;facts.set(key,{...f,value:Math.max(f.value,old?.value??0)});}
 const next={facts:[...facts.values()],awards:state.awards.filter(a=>rules.some(b=>b.id===a.id)).map(a=>({...a}))};
 for(const b of rules){const value=progress(next,b.metric);if(value<b.target)continue;let a=next.awards.find(a=>a.id===b.id);if(!a){a={id:b.id,earnedAt:now};next.awards.push(a);}if(b.challengeId&&value===25&&!a.plenoAt)a.plenoAt=now;}
 return next;
}
export function mergeStates(local:BadgeState,remote:BadgeState,rules:Rule[]) {
 const merged=applyFacts(local,remote.facts,rules);
 for(const a of remote.awards){const i=merged.awards.findIndex(x=>x.id===a.id);if(i>=0)merged.awards[i]={...merged.awards[i],...a};else if(rules.some(b=>b.id===a.id))merged.awards.push(a);}
 return merged;
}
export function newAwards(before:BadgeState,after:BadgeState){return after.awards.filter(a=>{const old=before.awards.find(x=>x.id===a.id);return !old||(!old.plenoAt&&!!a.plenoAt);});}
