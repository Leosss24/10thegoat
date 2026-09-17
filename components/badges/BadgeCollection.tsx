'use client';
import {useEffect,useRef,useSyncExternalStore,useState} from 'react';
import Link from 'next/link';
import {badges,gameNames,type Badge,type Locale} from '../../lib/badges/catalog';
import {madridDate} from '../../lib/trivia/challenge-schedule';
import {progress} from '../../lib/badges/engine';
import {syncBadges} from '../../lib/badges/client';
import {useBadges} from './useBadges';
import BadgeShield from './BadgeShield';
export type ChallengeAvailability={id:string;available:boolean;opensOn:string|null};
function subscribeCalendar(onChange:()=>void){const timer=setInterval(onChange,60000);window.addEventListener('focus',onChange);return()=>{clearInterval(timer);window.removeEventListener('focus',onChange);};}
export default function BadgeCollection({locale,challenges=[]}:{locale:Locale;challenges?:ChallengeAvailability[]}){
 const {state,owner,status,persistenceFailed}=useBadges();
 const [filter,setFilter]=useState('all');
 const [selected,setSelected]=useState<Badge|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const today=useSyncExternalStore(subscribeCalendar,()=>madridDate(new Date()),()=>null);
 const t=(es:string,en:string,fr:string)=>locale==='es'?es:locale==='fr'?fr:en;
 function info(b:Badge){
  const award=state.awards.find(a=>a.id===b.id),value=progress(state,b.metric);
  const availability=challenges.find(c=>c.id===b.challengeId);
  const released=availability?.available||!!(availability?.opensOn&&today&&today>=availability.opensOn);
  const locked=!!b.challengeId&&!released&&!award;
  return {award,value,availability,locked};
 }
 const detail=selected?info(selected):null;
 useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();else if(!selected)dialog.current?.close();},[selected]);
 return <section className="badge-collection badge-collection-compact user-card" id="badges">
 <header><div><span>{state.awards.length}/{badges.length} {t('CONSEGUIDOS','EARNED','OBTENUS')}</span><h2>{t('Colección de badges','Badge collection','Collection de badges')}</h2></div><label>{t('Juego','Game','Jeu')}<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t('Todos','All','Tous')}</option>{Object.entries(gameNames).map(([key,name])=><option key={key} value={key}>{name[locale]}</option>)}</select></label></header>
 <p className="badge-save-status" role="status">{persistenceFailed&&status!=='saved'?t('No se puede guardar en este navegador. Mantén la página abierta hasta sincronizar.','This browser cannot save progress. Keep this page open until synced.','Ce navigateur ne peut pas enregistrer la progression. Gardez la page ouverte jusqu’à la synchronisation.'):!owner?t('Inicia sesión antes de jugar para guardar tus badges en tu cuenta.','Sign in before playing to save badges to your account.','Connectez-vous avant de jouer pour conserver vos badges.'):status==='saved'?t('Colección sincronizada con tu cuenta.','Collection synced to your account.','Collection synchronisée avec votre compte.'):status==='syncing'?t('Sincronizando…','Syncing…','Synchronisation…'):t('Sincronización pendiente. Tu progreso se conserva en este navegador.','Sync pending. Your progress is saved in this browser.','Synchronisation en attente. Votre progression est conservée dans ce navigateur.')}{owner&&status==='error'&&<button onClick={()=>void syncBadges()}>{t('Reintentar','Retry','Réessayer')}</button>}</p>
 <p className="badge-collection-hint">{t('Pulsa un badge para ver cómo conseguirlo.','Select a badge to see how to earn it.','Sélectionnez un badge pour savoir comment l’obtenir.')}</p>
 <div className="collectible-grid">{badges.filter(b=>filter==='all'||filter===b.game).map(b=>{
 const {award,value,locked}=info(b);
 const label=award?(award.plenoAt?'★ '+t('Pleno','Perfect','Sans-faute'):'✓ '+t('Conseguido','Earned','Obtenu')):locked?t('Próximamente','Coming soon','Bientôt'):`${Math.min(value,b.target)}/${b.target}`;
 return <button type="button" key={b.id} className={`collectible-card${award?' is-earned':''}`} data-badge-id={b.id} data-available={!locked} aria-haspopup="dialog" aria-label={`${b.name[locale]} · ${gameNames[b.game][locale]} · ${label}`} onClick={()=>setSelected(b)}>
 <BadgeShield badge={b} pleno={!!award?.plenoAt} locked={!award}/><span className="collectible-name">{b.name[locale]}</span><small className="collectible-state">{label}</small>
 </button>;
 })}</div>
 <dialog ref={dialog} className="badge-award-dialog badge-detail-dialog" aria-labelledby="badge-detail-title" onCancel={()=>setSelected(null)} onClose={()=>setSelected(null)}>
 <button className="badge-close" onClick={()=>setSelected(null)} aria-label={t('Cerrar','Close','Fermer')}>×</button>
 {selected&&detail&&<><p className="badge-kicker">{gameNames[selected.game][locale]}</p><BadgeShield badge={selected} pleno={!!detail.award?.plenoAt} locked={!detail.award}/><h2 id="badge-detail-title">{selected.name[locale]}</h2><p>{selected.description[locale]}</p>
 {detail.award?<><strong>{detail.award.plenoAt?'★ '+t('Pleno','Perfect','Sans-faute'):'✓ '+t('Conseguido','Earned','Obtenu')}</strong><p><time dateTime={detail.award.earnedAt}>{new Date(detail.award.earnedAt).toLocaleDateString(locale)}</time></p>{selected.challengeId&&!detail.award.plenoAt&&<p>{t('Mejor resultado','Best result','Meilleur résultat')}: {detail.value}/25</p>}</>:detail.locked?<p>{detail.availability?.opensOn?t('Disponible el ','Available on ','Disponible le ')+new Date(detail.availability.opensOn+'T12:00:00').toLocaleDateString(locale):t('Próximamente','Coming soon','Bientôt')}</p>:<><progress max={selected.target} value={Math.min(detail.value,selected.target)} aria-label={selected.name[locale]}/><p>{Math.min(detail.value,selected.target)}/{selected.target}</p></>}
 <div className="badge-award-actions">{!detail.locked&&<Link href={`/${locale}/juegos/${selected.challengeId?'trivia/reto/'+selected.challengeId:selected.game}`} onClick={()=>setSelected(null)}>{t('Jugar','Play','Jouer')} →</Link>}<button onClick={()=>setSelected(null)}>{t('Cerrar','Close','Fermer')}</button></div></>}
 </dialog></section>;
}
