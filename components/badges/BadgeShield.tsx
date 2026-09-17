import type { Badge } from '../../lib/badges/catalog';
import { palettes } from '../../lib/badges/catalog';
export default function BadgeShield({badge,pleno=false,locked=false}:{badge:Badge;pleno?:boolean;locked?:boolean}){
 const [fill,ink]=palettes[badge.game];
 const trophy=<><path d="M37 32h26v14c0 12-6 18-13 18S37 58 37 46z"/><path d="M36 35H26v9q0 12 15 12M64 35h10v9q0 12-15 12" fill="none" stroke={ink} strokeWidth="5"/><path d="M47 61h6v12h10v5H37v-5h10z"/></>;
 let symbol;
 if(badge.challengeId?.startsWith('mundiales'))symbol=<><circle cx="50" cy="36" r="12"/><path d="M31 43q5 4 11 9l4 17h-8v8h24v-8h-8l4-17q6-5 11-9l-4-7-14 16h-2L35 36z"/></>;
 else if(badge.challengeId)symbol=<>{trophy}{badge.challengeId.startsWith('premier')&&<path d="M36 25l4 7h20l4-7-8 3-6-7-6 7z"/>}</>;
 else switch(badge.game){
 case 'adivina-jugador':symbol=<><path d="M36 30l-14 9 8 13 8-4v28h24V48l8 4 8-13-14-9-9 6H45z"/><text x="50" y="63" textAnchor="middle" fill={fill} fontSize="29" fontWeight="800">?</text></>;break;
 case 'carrera':symbol=trophy;break;
 case 'mayor-o-menor':symbol=<><path d="M32 31L20 45h8v25h9V45h8zM64 74l13-14h-8V35h-9v25h-8z"/></>;break;
 case 'football-grid':symbol=<>{Array.from({length:16},(_,i)=><rect key={i} x={28+i%4*12} y={31+Math.floor(i/4)*12} width="9" height="9" rx="1"/>)}</>;break;
 case 'adivina-escudo':symbol=<path d="M29 33l21-7 21 7v20q-2 17-21 26-19-9-21-26zm7 6v14q1 11 14 18V34z"/>;break;
 case 'trivia':symbol=badge.id==='trivia.timed'?<><circle cx="50" cy="53" r="21" fill="none" stroke={ink} strokeWidth="6"/><path d="M46 22h8v10h-8zM48 39h5v16H39v-5h9z"/></>:<text x="50" y="72" textAnchor="middle" fontSize="64" fontWeight="800">?</text>;break;
 case 'el-intruso':symbol=<><circle cx="36" cy="41" r="10"/><circle cx="64" cy="41" r="10"/><circle cx="36" cy="68" r="10"/><circle cx="64" cy="68" r="8" fill="none" stroke={ink} strokeWidth="4"/></>;break;
 case 'conexiones':symbol=<><path d="M50 32L28 54l22 22 22-22z" fill="none" stroke={ink} strokeWidth="5"/>{[[50,32],[28,54],[50,76],[72,54]].map(([cx,cy])=><circle key={cx+':'+cy} cx={cx} cy={cy} r="9"/>)}</>;break;
 default:symbol=<><path d="M25 54h50" stroke={ink} strokeWidth="6"/>{[27,50,73].map(cx=><circle key={cx} cx={cx} cy="54" r="9"/>)}</>;
 }
 const marker=badge.id.endsWith('.collection')?String(badge.target):badge.id.endsWith('.perfect')?'★':badge.id==='trivia.easy'?'5':badge.id==='trivia.hard'?'7':null;
 return <svg className={`collectible-shield${locked?' is-locked':''}`} viewBox="0 0 100 112" aria-hidden="true"><path fill={fill} d="M50 3L91 18q5 2 5 8v36q0 27-46 47Q4 89 4 62V26q0-6 5-8z"/><g fill={ink}>{symbol}{pleno&&<path d="M50 11l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>}{marker&&<text x="50" y="96" textAnchor="middle" fontSize="15" fontWeight="800">{marker}</text>}</g></svg>;
}
