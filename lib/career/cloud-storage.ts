import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase.ts";
import { hydrateCareer } from "./engine.ts";
import type { CareerState } from "./types.ts";
export type CareerSnapshot={id:string;name:string;created_at:string;summary:{playerName:string;shirtNumber:number;year:number;overall:number;club:string};game_state:CareerState};
export async function currentUser():Promise<User|null>{if(!supabase)return null;return (await supabase.auth.getUser()).data.user}
export async function listCareerSnapshots(){if(!supabase)return [] as CareerSnapshot[];const {data,error}=await supabase.from("game_saves").select("id,name,created_at,summary,game_state").eq("game_key","career").order("created_at",{ascending:true});if(error)throw error;return (data??[]).map(x=>({...x,game_state:hydrateCareer(x.game_state as CareerState)})) as CareerSnapshot[]}
export async function saveCareerSnapshot(state:CareerState){if(!supabase)throw new Error("Supabase no está configurado");const user=await currentUser();if(!user)throw new Error("Debes iniciar sesión");const summary={playerName:state.player.name,shirtNumber:state.player.shirtNumber,year:state.year,overall:state.player.overall,club:state.club.name};const {data,error}=await supabase.from("game_saves").insert({user_id:user.id,game_key:"career",name:state.player.name,game_state:state,summary}).select("id").single();if(error)throw error;return data.id as string}
export async function deleteCareerSnapshot(id:string){if(!supabase)return;const {error}=await supabase.from("game_saves").delete().eq("id",id);if(error)throw error}
