/** Builds 100 themed histories, preserving the four original challenge IDs. */
import fs from 'node:fs';
const challenges=JSON.parse(fs.readFileSync('data/timeline/legacy.json','utf8'));
const tr=(es,en,fr)=>({es,en,fr});
for(let season=2013;season<=2024;season++){
 const rows=JSON.parse(fs.readFileSync(`tmp/content-audit/fixtures/champions-${season}.json`)).filter(f=>['FT','AET','PEN'].includes(f.fixture.status.short)&&!/(qualif|play-off)/i.test(f.league.round)&&Number.isInteger(f.goals.home)&&Number.isInteger(f.goals.away));
 const teams=new Map();for(const f of rows)for(const team of [f.teams.home,f.teams.away]){if(!teams.has(team.id))teams.set(team.id,{team,fixtures:[]});teams.get(team.id).fixtures.push(f);}
 const campaigns=[...teams.values()].filter(t=>t.fixtures.length>=8).map(t=>({...t,fixtures:t.fixtures.sort((a,b)=>a.fixture.timestamp-b.fixture.timestamp)})).sort((a,b)=>b.fixtures.at(-1).fixture.timestamp-a.fixtures.at(-1).fixture.timestamp||b.fixtures.length-a.fixtures.length||a.team.id-b.team.id).slice(0,8);
 if(campaigns.length!==8)throw Error('Incomplete season '+season);
 for(const {team,fixtures} of campaigns){const yearLabel=`${season}/${String(season+1).slice(-2)}`;
  const selected=Array.from({length:5},(_,i)=>fixtures[Math.round(i*(fixtures.length-1)/4)]);
  const events=selected.map(f=>{const score=`${f.goals.home}–${f.goals.away}`;const penalties=f.fixture.status.short==='PEN'?` (${f.score.penalty.home}–${f.score.penalty.away} pen.)`:'';const text=`${f.teams.home.name} ${score} ${f.teams.away.name}${penalties}`;return {id:'fixture-'+f.fixture.id,year:Number(f.fixture.date.slice(0,4)),date:f.fixture.date.slice(0,10),fixtureId:f.fixture.id,text:tr(text,text,text)};});
  if(new Set(events.map(e=>e.date)).size!==5)throw Error('Repeated date');
  challenges.push({id:`ucl-${season}-${team.id}`,category:tr(`Champions League · ${yearLabel}`,`Champions League · ${yearLabel}`,`Ligue des champions · ${yearLabel}`),title:tr(`La campaña de ${team.name}`,`${team.name}'s campaign`,`${team.name} : le parcours`),events,explanation:tr(`Cinco partidos de ${team.name} en la Champions ${yearLabel}, desde la fase inicial hasta su último encuentro. El equipo local figura primero.`,`Five ${team.name} matches in the ${yearLabel} Champions League, from the opening stage to their final match. The home team is listed first.`,`${team.name} en Ligue des champions ${yearLabel} : cinq matchs, de la phase initiale au dernier match. L'équipe à domicile figure en premier.`),source:`https://www.uefa.com/uefachampionsleague/history/seasons/${season+1}/`,providerSource:`https://www.api-football.com/documentation-v3#tag/Fixtures`,season,teamId:team.id});
 }
}
fs.writeFileSync('data/timeline/challenges.json',JSON.stringify(challenges,null,2)+'\n');console.log('Histories:',challenges.length,'unique:',new Set(challenges.map(c=>c.events.map(e=>e.id).sort().join('|'))).size);
