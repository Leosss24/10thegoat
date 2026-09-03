"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { deleteCareerSnapshot, listCareerSnapshots, type CareerSnapshot } from "../lib/career/cloud-storage";
import { loadCareer, saveCareer } from "../lib/career/storage";
import type { CareerState } from "../lib/career/types";
import { getAllGameScores, type GameScoreStats } from "../lib/game-scores";
import { uniqueSeniorBadges } from "../lib/football/club-filter";
import { translatedCountry } from "../lib/football/country-i18n";

type Profile = { username:string|null; display_name:string|null; avatar_url:string|null; avatar_club_id:number|null; username_changed_at:string|null; created_at:string; last_seen_at:string|null };
type BadgeOption = { id:number; name:string; badge_url:string; is_national_team:boolean; domestic_division:1|2|null; countries:{name:string}|null };
type RemoteStats = GameScoreStats & { game_key:string };
const GAME_NAMES:Record<string,[string,string,string]> = {
  "adivina-jugador":["ADIVINA EL JUGADOR","GUESS THE PLAYER","DEVINEZ LE JOUEUR"],
  "mayor-o-menor":["MAYOR O MENOR","HIGHER OR LOWER","PLUS OU MOINS"],
  "adivina-escudo":["ADIVINA EL ESCUDO","GUESS THE BADGE","DEVINEZ L'ÉCUSSON"],
};

export default function UserDashboard({locale}:{locale:"es"|"en"|"fr"}) {
  const router=useRouter();
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [saves,setSaves]=useState<CareerSnapshot[]>([]);
  const [stats,setStats]=useState<RemoteStats[]>([]);
  const [localCareer,setLocalCareer]=useState<CareerState|null>(null);
  const [badges,setBadges]=useState<BadgeOption[]>([]);
  const [username,setUsername]=useState("");
  const [message,setMessage]=useState("");
  const [badgeOpen,setBadgeOpen]=useState(false);
  const [badgeTab,setBadgeTab]=useState<"teams"|"clubs">("teams");
  const [badgeQuery,setBadgeQuery]=useState("");
  const [badgesLoading,setBadgesLoading]=useState(false);
  const t=(es:string,en:string,fr:string)=>locale==="es"?es:locale==="fr"?fr:en;

  const syncStats=async(u:User)=>{
    if(!supabase)return;
    const client=supabase;
    const local=getAllGameScores();
    await Promise.all(Object.entries(local).map(([gameKey,value])=>client.rpc("sync_own_game_stats",{
      p_game_key:gameKey,p_points:value.points,p_played:value.played,p_wins:value.wins,
      p_best_score:value.bestScore,p_hints_used:value.hintsUsed,p_surrenders:value.surrenders,
    })));
    const {data}=await client.from("user_game_stats").select("game_key,points,played,wins,best_score,hints_used,surrenders").eq("user_id",u.id);
    setStats((data??[]).map(x=>({game_key:x.game_key,points:x.points,played:x.played,wins:x.wins,bestScore:x.best_score,hintsUsed:x.hints_used,surrenders:x.surrenders})));
  };
  const load=async(u:User)=>{
    if(!supabase)return;
    const [{data:p},s]=await Promise.all([
      supabase.from("profiles").select("username,display_name,avatar_url,avatar_club_id,username_changed_at,created_at,last_seen_at").eq("id",u.id).maybeSingle(),
      listCareerSnapshots(),
    ]);
    setProfile(p as Profile|null); setUsername(p?.username??""); setSaves(s); setLocalCareer(loadCareer());
    void syncStats(u);
    void supabase.from("profiles").update({last_seen_at:new Date().toISOString()}).eq("id",u.id);
  };
  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getUser().then(({data})=>{setUser(data.user);if(data.user)void load(data.user)});
    const {data}=supabase.auth.onAuthStateChange((_e,s)=>{setUser(s?.user??null);if(s?.user)void load(s.user)});
    return()=>data.subscription.unsubscribe();
  },[]);

  const login=(provider:"google"|"twitter")=>supabase?.auth.signInWithOAuth({provider:provider==="twitter"?"x":provider,options:{redirectTo:location.href}});
  const saveName=async()=>{
    if(!supabase||!user)return;
    const clean=username.trim();
    if(!/^[A-Za-z0-9_]{3,20}$/.test(clean))return setMessage(t("USA ENTRE 3 Y 20 LETRAS, NÚMEROS O GUIONES BAJOS.","USE 3–20 LETTERS, NUMBERS OR UNDERSCORES.","UTILISEZ 3 À 20 LETTRES, CHIFFRES OU TIRETS BAS."));
    const {error}=await supabase.from("profiles").upsert({id:user.id,username:clean,display_name:profile?.display_name,avatar_url:profile?.avatar_url,username_changed_at:new Date().toISOString()});
    if(error)setMessage(error.code==="23505"?t("ESE NOMBRE YA ESTÁ OCUPADO.","THAT NAME IS ALREADY TAKEN.","CE NOM EST DÉJÀ UTILISÉ."):error.message.includes("username_change_cooldown")?t("AÚN NO PUEDES CAMBIAR TU NOMBRE.","YOU CANNOT CHANGE YOUR NAME YET.","VOUS NE POUVEZ PAS ENCORE CHANGER DE NOM."):error.message);
    else {setMessage(t("NOMBRE GUARDADO.","NAME SAVED.","NOM ENREGISTRÉ."));await load(user)}
  };
  const openBadges=async()=>{
    setBadgeOpen(true);
    if(!supabase)return;
    setBadgesLoading(true);
    const all:BadgeOption[]=[];
    for(let from=0;;from+=1000){
      const {data,error}=await supabase.from("clubs").select("id,name,badge_url,is_national_team,domestic_division,countries(name)").eq("is_active",true).not("badge_url","is",null).order("name").range(from,from+999);
      if(error){setMessage(error.message);setBadgesLoading(false);return}
      all.push(...((data??[]) as unknown as BadgeOption[]));
      if((data?.length??0)<1000)break;
    }
    setBadges(uniqueSeniorBadges(all));
    setBadgesLoading(false);
  };
  const chooseBadge=async(badge:BadgeOption)=>{
    if(!supabase||!user)return;
    const {error}=await supabase.from("profiles").update({avatar_url:badge.badge_url,avatar_club_id:badge.id}).eq("id",user.id);
    if(error)return setMessage(error.message);
    setBadgeOpen(false); setMessage(t("ESCUDO ACTUALIZADO.","BADGE UPDATED.","ÉCUSSON MIS À JOUR.")); await load(user);
  };

  const canRename=!profile?.username||Boolean(profile.username_changed_at&&Date.now()-new Date(profile.username_changed_at).getTime()>=183*86400000);
  const renameDate=profile?.username_changed_at?new Date(new Date(profile.username_changed_at).getTime()+183*86400000):null;
  const filteredBadges=useMemo(()=>badges.filter(b=>{
    const rightKind=b.is_national_team===(badgeTab==="teams");
    const rightDivision=b.is_national_team||b.domestic_division===1||b.domestic_division===2;
    const country=translatedCountry(b.countries?.name??(b.is_national_team?b.name:""),locale);
    return rightKind&&rightDivision&&`${b.name} ${country}`.toLocaleLowerCase().includes(badgeQuery.toLocaleLowerCase());
  }).slice(0,120),[badges,badgeTab,badgeQuery,locale]);
  const totals=stats.reduce((a,s)=>({played:a.played+s.played,wins:a.wins+s.wins,points:a.points+s.points}),{played:0,wins:0,points:0});
  const careerProgress=useMemo(()=>{
    const careers=new Map<string,CareerState>();
    for(const state of [...saves.map(x=>x.game_state),...(localCareer?[localCareer]:[])])careers.set(state.id,state);
    const states=[...careers.values()],seasons=states.flatMap(x=>x.seasons);
    const competitions=seasons.flatMap(x=>x.competitions??[]).filter(x=>x.champion),awards=seasons.flatMap(x=>x.individualAwards??[]);
    return {count:states.length,legacy:Math.max(0,...states.map(x=>x.legacyScore)),continental:competitions.filter(x=>x.kind==="continental").length,international:competitions.filter(x=>x.kind==="international").length,awards:awards.length,ballonDor:awards.filter(x=>x==="Balón de Oro").length};
  },[saves,localCareer]);
  const achievements:[boolean,string,string][]=[
    [totals.played>0,t("PRIMER PARTIDO","FIRST GAME","PREMIER MATCH"),`${Math.min(totals.played,1)}/1`],
    [totals.wins>0,t("PRIMER ACIERTO","FIRST SUCCESS","PREMIER SUCCÈS"),`${Math.min(totals.wins,1)}/1`],
    [totals.played>=10,t("DIEZ PARTIDAS","TEN GAMES","DIX PARTIES"),`${Math.min(totals.played,10)}/10`],
    [totals.points>=100,t("100 PUNTOS","100 POINTS","100 POINTS"),`${Math.min(totals.points,100)}/100`],
    [careerProgress.count>0,t("UNA CARRERA EN JUEGO","A CAREER IN PLAY","UNE CARRIÈRE EN COURS"),`${Math.min(careerProgress.count,1)}/1`],
    [careerProgress.continental>0,t("CAMPEÓN CONTINENTAL","CONTINENTAL CHAMPION","CHAMPION CONTINENTAL"),`${Math.min(careerProgress.continental,1)}/1`],
    [careerProgress.international>0,t("CAMPEÓN CON TU SELECCIÓN","INTERNATIONAL CHAMPION","CHAMPION EN SÉLECTION"),`${Math.min(careerProgress.international,1)}/1`],
    [careerProgress.awards>0,t("PREMIO INDIVIDUAL","INDIVIDUAL HONOUR","TROPHÉE INDIVIDUEL"),`${Math.min(careerProgress.awards,1)}/1`],
    [careerProgress.ballonDor>0,t("BALÓN DE ORO","BALLON D'OR","BALLON D'OR"),`${Math.min(careerProgress.ballonDor,1)}/1`],
    [careerProgress.legacy>=1000,t("LEGADO 1.000","1,000 LEGACY","HÉRITAGE 1 000"),`${Math.min(careerProgress.legacy,1000)}/1000`],
    [careerProgress.legacy>=3000,t("LEGADO 3.000","3,000 LEGACY","HÉRITAGE 3 000"),`${Math.min(careerProgress.legacy,3000)}/3000`],
    [careerProgress.legacy>=5000,t("LEYENDA · LEGADO 5.000","LEGEND · 5,000 LEGACY","LÉGENDE · HÉRITAGE 5 000"),`${Math.min(careerProgress.legacy,5000)}/5000`],
  ];
  const date=(value?:string|null)=>value?new Intl.DateTimeFormat(locale,{dateStyle:"long",timeStyle:"short"}).format(new Date(value)):"—";

  if(!user)return <main className="user-page container"><section className="user-hero user-login"><span>10THEGOAT ID</span><h1>{t("TU ZONA DE USUARIO","YOUR ACCOUNT","VOTRE ESPACE")}</h1><p>{t("ENTRA PARA GUARDAR CARRERAS, CONSERVAR ESTADÍSTICAS Y DESBLOQUEAR LOGROS.","SIGN IN TO SAVE CAREERS, KEEP STATS AND UNLOCK ACHIEVEMENTS.","CONNECTEZ-VOUS POUR SAUVEGARDER VOS CARRIÈRES ET VOS STATS.")}</p><div className="career-social-login"><button onClick={()=>login("google")}>G · GOOGLE</button><button onClick={()=>login("twitter")}>𝕏 · TWITTER / X</button></div></section></main>;

  return <main className="user-page container">
    <section className="user-hero">
      <div className="user-identity">
        <button className="user-avatar" onClick={openBadges} aria-label={t("Elegir escudo","Choose badge","Choisir un écusson")}>{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:<b>{(profile?.username??profile?.display_name??"U")[0]}</b>}<span>＋</span></button>
        <div><span>{t("PERFIL 10THEGOAT","10THEGOAT PROFILE","PROFIL 10THEGOAT")}</span><h1>{profile?.username??profile?.display_name??t("ELIGE TU NOMBRE","CHOOSE YOUR NAME","CHOISISSEZ VOTRE NOM")}</h1><small>{t("MIEMBRO DESDE","MEMBER SINCE","MEMBRE DEPUIS")} {date(profile?.created_at)}</small></div>
        <button className="user-signout" onClick={()=>supabase?.auth.signOut()}>{t("CERRAR SESIÓN","SIGN OUT","SE DÉCONNECTER")}</button>
      </div>
      <button className="user-choose-badge" onClick={openBadges}>{t("ELEGIR ESCUDO DE PERFIL","CHOOSE PROFILE BADGE","CHOISIR L'ÉCUSSON DU PROFIL")}</button>
      <div className="user-quick-stats"><div><span>{t("ÚLTIMA CONEXIÓN","LAST SEEN","DERNIÈRE CONNEXION")}</span><strong>{date(profile?.last_seen_at??user.last_sign_in_at)}</strong></div><div><span>{t("PARTIDAS","GAMES","PARTIES")}</span><strong>{totals.played}</strong></div><div><span>{t("VICTORIAS / ACIERTOS","WINS / CORRECT","VICTOIRES / SUCCÈS")}</span><strong>{totals.wins}</strong></div><div><span>{t("PUNTOS","POINTS","POINTS")}</span><strong>{totals.points}</strong></div></div>
      <div className="username-editor"><input value={username} maxLength={20} disabled={!!profile?.username&&!canRename} onChange={e=>setUsername(e.target.value)} placeholder={t("NOMBRE ÚNICO","UNIQUE NAME","NOM UNIQUE")}/><button disabled={!!profile?.username&&!canRename} onClick={saveName}>{profile?.username?t("CAMBIAR NOMBRE","CHANGE NAME","CHANGER LE NOM"):t("GUARDAR NOMBRE","SAVE NAME","ENREGISTRER")}</button><small>{profile?.username&&!canRename?t(`BLOQUEADO HASTA ${date(renameDate?.toISOString())}.`,`LOCKED UNTIL ${date(renameDate?.toISOString())}.`,`BLOQUÉ JUSQU'AU ${date(renameDate?.toISOString())}.`):t("3–20 CARACTERES. NO PUEDE REPETIRSE.","3–20 CHARACTERS. MUST BE UNIQUE.","3–20 CARACTÈRES. DOIT ÊTRE UNIQUE.")}</small></div>
      {message&&<p className="user-message">{message}</p>}
    </section>
    <div className="user-dashboard-grid">
      <section className="user-card user-game-stats"><header><span>01</span><h2>{t("ESTADÍSTICAS","STATISTICS","STATISTIQUES")}</h2></header>{!stats.length?<p>{t("JUEGA TU PRIMERA PARTIDA PARA ESTRENAR EL MARCADOR.","PLAY YOUR FIRST GAME TO START THE SCOREBOARD.","JOUEZ VOTRE PREMIÈRE PARTIE.")}</p>:stats.map(s=>{const higher=s.game_key==="mayor-o-menor",accuracy=higher?s.wins/Math.max(1,s.wins+s.played):s.wins/Math.max(1,s.played);return <article key={s.game_key}><div><strong>{t(...(GAME_NAMES[s.game_key]??[s.game_key,s.game_key,s.game_key]))}</strong><small>{s.played} {t("PARTIDAS","GAMES","PARTIES")} · {s.wins} {higher?t("ACIERTOS","CORRECT","SUCCÈS"):t("VICTORIAS","WINS","VICTOIRES")} · {Math.round(accuracy*100)}%</small></div><b>{s.points}</b><span>{higher?t("MEJOR RACHA","BEST STREAK","MEILLEURE SÉRIE"):t("RÉCORD","BEST","RECORD")} {higher?Math.floor(s.bestScore/10):s.bestScore}</span></article>})}</section>
      <section className="user-card user-achievements"><header><span>02</span><h2>{t("LOGROS","ACHIEVEMENTS","SUCCÈS")}</h2></header><div>{achievements.map(([ok,label,progress])=><article className={ok?"is-earned":""} key={label}><i>{ok?"✓":"◇"}</i><span><b>{label}</b><small>{progress}</small></span></article>)}</div></section>
    </div>
    <section className="pending-games user-card"><header><span>03</span><h2>{t("JUEGOS PENDIENTES DE ACABAR","UNFINISHED GAMES","JEUX À TERMINER")}</h2></header>{!saves.length?<p>{t("No hay minijuegos por finalizar.","There are no unfinished minigames.","Aucun mini-jeu à terminer.")}</p>:<div>{saves.map(x=><article key={x.id}><div><small>MODO CARRERA</small><h3>{x.summary.playerName} <b>#{x.summary.shirtNumber}</b></h3><span>{x.summary.club} · {x.summary.year}/{String(x.summary.year+1).slice(-2)} · {t("MEDIA","OVR","NOTE")} {x.summary.overall}</span></div><button onClick={()=>{saveCareer(x.game_state);router.push(`/${locale}/juegos/carrera`)}}>{t("CONTINUAR DESDE AQUÍ","CONTINUE FROM HERE","REPRENDRE ICI")}</button><button className="is-delete" onClick={async()=>{if(!confirm(t("¿ELIMINAR ESTA CARRERA?","DELETE THIS CAREER?","SUPPRIMER CETTE CARRIÈRE ?")))return;await deleteCareerSnapshot(x.id);await load(user)}}>{t("ELIMINAR","DELETE","SUPPRIMER")}</button></article>)}</div>}</section>
    {badgeOpen&&<div className="user-badge-backdrop" onClick={()=>setBadgeOpen(false)}><section className="user-badge-picker" onClick={e=>e.stopPropagation()}><header><div><span>{t("IDENTIDAD DE PERFIL","PROFILE IDENTITY","IDENTITÉ DU PROFIL")}</span><h2>{t("ELIGE TU ESCUDO","CHOOSE YOUR BADGE","CHOISISSEZ VOTRE ÉCUSSON")}</h2></div><button onClick={()=>setBadgeOpen(false)}>×</button></header><div className="user-badge-tabs"><button className={badgeTab==="teams"?"is-active":""} onClick={()=>setBadgeTab("teams")}>{t("SELECCIONES","NATIONAL TEAMS","SÉLECTIONS")}</button><button className={badgeTab==="clubs"?"is-active":""} onClick={()=>setBadgeTab("clubs")}>{t("CLUBES","CLUBS","CLUBS")}</button></div><input className="user-badge-search" value={badgeQuery} onChange={e=>setBadgeQuery(e.target.value)} placeholder={t("BUSCAR ESCUDO…","SEARCH BADGES…","CHERCHER…")}/>{badgesLoading?<p className="user-badge-empty">{t("CARGANDO ESCUDOS…","LOADING BADGES…","CHARGEMENT DES ÉCUSSONS…")}</p>:filteredBadges.length?<div className="user-badge-grid">{filteredBadges.map(b=>{const country=translatedCountry(b.countries?.name??(b.is_national_team?b.name:""),locale);return <button key={b.id} className={profile?.avatar_club_id===b.id?"is-active":""} onClick={()=>chooseBadge(b)}><img src={b.badge_url} alt=""/><strong>{b.is_national_team?country:b.name}</strong>{!b.is_national_team&&<small>{country} · {t(`${b.domestic_division}.ª DIVISIÓN`,`${b.domestic_division===1?"1ST":"2ND"} DIVISION`,`${b.domestic_division===1?"1RE":"2E"} DIVISION`)}</small>}</button>})}</div>:<p className="user-badge-empty">{t("NO HAY ESCUDOS QUE COINCIDAN.","NO MATCHING BADGES.","AUCUN ÉCUSSON CORRESPONDANT.")}</p>}</section></div>}
  </main>;
}
