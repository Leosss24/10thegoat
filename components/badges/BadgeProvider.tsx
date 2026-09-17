'use client';
import {useEffect,useRef} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import {badges} from '../../lib/badges/catalog';
import {dismissBadge,setBadgeOwner,syncBadges,receiveBadgeStorage} from '../../lib/badges/client';
import {useI18n} from '../I18nProvider';
import {useBadges} from './useBadges';
import BadgeShield from './BadgeShield';
export default function BadgeProvider(){
 const {locale}=useI18n();const {notices,status,owner,persistenceFailed}=useBadges();const dialog=useRef<HTMLDialogElement>(null);
 const t=(es:string,en:string,fr:string)=>locale==='es'?es:locale==='fr'?fr:en;
 useEffect(()=>{
  if(!supabase){setBadgeOwner(null);return;}
  let alive=true,authChanged=false;
  const {data}=supabase.auth.onAuthStateChange((_event,session)=>{authChanged=true;setBadgeOwner(session?.user.id??null);});
  void supabase.auth.getSession().then(({data})=>{if(alive&&!authChanged)setBadgeOwner(data.session?.user.id??null);});
  const storage=(event:StorageEvent)=>receiveBadgeStorage(event.key,event.newValue);window.addEventListener('storage',storage);
  const retry=()=>{void syncBadges();};window.addEventListener('online',retry);window.addEventListener('focus',retry);const timer=setInterval(retry,60000);
  return()=>{alive=false;data.subscription.unsubscribe();window.removeEventListener('storage',storage);window.removeEventListener('online',retry);window.removeEventListener('focus',retry);clearInterval(timer);};
 },[]);
 useEffect(()=>{
  if(!notices.length){dialog.current?.close();return;}
  // Avoid covering a game's own result dialog or an active timed round.
  const open=()=>{const el=dialog.current;if(el&&!el.open&&!document.querySelector('dialog[open]')&&!document.querySelector('[data-badges-busy="true"]'))el.showModal();};
  const timer=setInterval(open,300);open();return()=>clearInterval(timer);
 },[notices]);
 const close=()=>notices.forEach(a=>dismissBadge(a.id));
 return <dialog ref={dialog} className="badge-award-dialog" aria-labelledby="badge-award-title" onCancel={close} onClose={close}>
 <button className="badge-close" onClick={close} aria-label={t('Cerrar','Close','Fermer')}>×</button>
 <p className="badge-kicker">10THEGOAT · {t('COLECCIÓN','COLLECTION','COLLECTION')}</p>
 <h2 id="badge-award-title">{t('¡Nuevo badge!','New badge!','Nouveau badge !')}</h2>
 <div className="badge-award-list">{notices.map(a=>{const b=badges.find(b=>b.id===a.id)!;return <article key={a.id}><BadgeShield badge={b} pleno={!!a.plenoAt}/><h3>{b.name[locale]}{a.plenoAt?' · '+t('Pleno','Perfect','Sans-faute'):''}</h3><p>{b.description[locale]}</p></article>;})}</div>
 <p className="badge-save-status">{persistenceFailed&&status!=='saved'?t('No se ha podido guardar en este navegador.','Could not save in this browser.','Impossible d’enregistrer dans ce navigateur.'):!owner?t('Disponible durante esta sesión. Inicia sesión antes de jugar para conservar tus próximos badges.','Available for this session. Sign in before playing to keep future badges.','Disponible pour cette session. Connectez-vous avant de jouer pour conserver vos prochains badges.'):status==='saved'?t('Guardado en tu colección.','Saved to your collection.','Enregistré dans votre collection.'):t('Guardado en este navegador. Sincronización con tu cuenta pendiente.','Saved in this browser. Account sync pending.','Enregistré dans ce navigateur. Synchronisation du compte en attente.')}</p>
 <div className="badge-award-actions"><Link href={`/${locale}/usuario#badges`} onClick={close}>{t('Ver colección','View collection','Voir la collection')}</Link><button onClick={close}>{t('Seguir jugando','Keep playing','Continuer à jouer')}</button></div>
 </dialog>;
}
