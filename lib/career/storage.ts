import type { CareerState } from "./types.ts";
export const CAREER_STORAGE_KEY="10tg-career-v2",ACHIEVEMENT_STORAGE_KEY="10tg-achievements-v1";
type Envelope={schemaVersion:2;savedAt:string;value:CareerState};
function valid(v:unknown):v is CareerState{if(!v||typeof v!=="object")return false;const x=v as Partial<CareerState>;return x.schemaVersion===2&&typeof x.id==="string"&&typeof x.seed==="number"&&!!x.player&&x.player.age>=15&&x.player.age<=40&&x.player.shirtNumber>=1&&x.player.shirtNumber<=99&&Array.isArray(x.seasons)&&Array.isArray(x.offers)&&!!x.club&&!!x.totals}
export function parseCareer(raw:string|null):CareerState|null{if(!raw)return null;try{const x=JSON.parse(raw) as Partial<Envelope>;return x.schemaVersion===2&&valid(x.value)?x.value:null}catch{return null}}
export function loadCareer():CareerState|null{if(typeof window==="undefined")return null;return parseCareer(localStorage.getItem(CAREER_STORAGE_KEY))}
export function saveCareer(state:CareerState){if(typeof window==="undefined")return false;try{const envelope:Envelope={schemaVersion:2,savedAt:new Date().toISOString(),value:state};localStorage.setItem(CAREER_STORAGE_KEY,JSON.stringify(envelope));localStorage.setItem(ACHIEVEMENT_STORAGE_KEY,JSON.stringify({schemaVersion:1,unlocked:state.unlockedAchievementIds}));return true}catch{return false}}
export function clearCareer(){if(typeof window!=="undefined")localStorage.removeItem(CAREER_STORAGE_KEY)}
