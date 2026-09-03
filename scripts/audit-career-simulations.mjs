import { createCareer, resolveOffer, simulateSeason, talentBandForSeed } from "../lib/career/engine.ts";
import { CAREER_CLUBS, starterClubsFor } from "../lib/career/clubs.ts";
import { decisionFor } from "../lib/career/decisions.ts";

const strategies={
  balanced:{focus:(s)=>s.player.age>32?"recovery":s.player.age<23?"development":"team",training:(s)=>s.player.age>33?"recovery":["balanced","technical","physical","mental"][s.year%4],choice:(s,d)=>bestChoice(d,{technical:1,physical:1,mentality:1,form:1.1,reputation:.7,family:.6}),offer:(s)=>s.offers.filter(x=>x.role!=="academy").sort((a,b)=>(b.club.level+b.club.youthOpportunity/12)-(a.club.level+a.club.youthOpportunity/12))[0]},
  ambitious:{focus:(s)=>s.player.age>34?"recovery":"visibility",training:(s)=>s.player.age>32?"mental":["technical","physical","balanced"][s.year%3],choice:(s,d)=>bestChoice(d,{technical:1.2,physical:1.1,mentality:.8,form:.5,reputation:1.2,family:.15}),offer:(s)=>[...s.offers].sort((a,b)=>b.club.level-a.club.level)[0]},
  loyal:{focus:(s)=>s.club.country===s.player.nationality?"team":"family",training:(s)=>s.player.age>31?"recovery":"balanced",choice:(s,d)=>bestChoice(d,{technical:.5,physical:.5,mentality:1,form:1,reputation:.4,family:1.5}),offer:()=>undefined},
  minutes:{focus:(s)=>s.player.age<25?"development":"team",training:(s)=>s.player.age>33?"recovery":"balanced",choice:(s,d)=>bestChoice(d,{technical:.8,physical:.8,mentality:.8,form:1.4,reputation:.3,family:.5}),offer:(s)=>[...s.offers].sort((a,b)=>roleValue(b.role)-roleValue(a.role)||b.club.youthOpportunity-a.club.youthOpportunity)[0]},
  risky:{focus:(s)=>s.player.age>35?"recovery":"visibility",training:()=>"physical",choice:(_s,d)=>d.choices[0],offer:(s)=>[...s.offers].sort((a,b)=>b.club.level-a.club.level)[0]},
};
const roleValue=(role)=>({academy:0,prospect:1,rotation:2,starter:3,star:4})[role]??0;
function bestChoice(decision,weights){return [...decision.choices].sort((a,b)=>score(b)-score(a))[0].id;function score(choice){const raw=Object.entries(choice.effects).reduce((n,[k,v])=>n+v*(weights[k]??.5),0);return choice.chance===undefined?raw:raw*(choice.chance/100)+Math.min(0,raw)*((100-choice.chance)/100)}}
const positions=["centre_back","right_back","holding_midfielder","central_midfielder","attacking_midfielder","right_winger","second_striker","striker"];
const nationalities=["España","Inglaterra","Alemania","Italia","Francia","Portugal","Países Bajos","Argentina","Brasil","Uruguay"];

function run(seed,strategyName){
  const strategy=strategies[strategyName],nationality=nationalities[seed%nationalities.length],starters=starterClubsFor(nationality,CAREER_CLUBS,seed,talentBandForSeed(seed)),club=starters[seed%Math.max(1,starters.length)]??CAREER_CLUBS[seed%CAREER_CLUBS.length];
  let state=createCareer({name:`SIM-${seed}`,shirtNumber:1+seed%99,nationality,position:positions[seed%positions.length],seed,club,year:2026});
  const initial={overall:state.player.overall,...state.player.blocks};let transfers=0,previousClub=state.club.id;
  while(state.status==="active"){
    if(state.phase==="offers"){
      const offer=strategy.offer(state);state=resolveOffer(state,offer?.id??null);
      if(state.club.id!==previousClub){transfers++;previousClub=state.club.id}
      continue;
    }
    const decision=decisionFor(state),choice=strategy.choice(state,decision);
    state=simulateSeason(state,strategy.focus(state),CAREER_CLUBS,strategy.training(state),choice);
  }
  const peak=state.seasons.reduce((best,x)=>x.overall>best.overall?x:best,state.seasons[0]);
  const champions=state.seasons.flatMap(x=>x.competitions??[]).filter(x=>x.champion);
  const awards=state.seasons.flatMap(x=>x.individualAwards??[]);
  const decisionRisks=state.seasons.map(x=>x.decision).filter(x=>x?.chance!==undefined);
  const favorable=decisionRisks.filter(x=>x.success).length;
  const blockDelta=Object.fromEntries(Object.keys(state.player.blocks).map(k=>[k,state.player.blocks[k]-initial[k]]));
  return {seed,strategy:strategyName,talent:state.player.talentBand,start:club.name,end:state.club.name,transfers,peakOverall:peak.overall,peakAge:peak.age,finalOverall:state.player.overall,titles:champions.length,titleKinds:Object.fromEntries(["domestic","cup","continental","international"].map(k=>[k,champions.filter(x=>x.kind===k).length])),awards:awards.length,ballonDor:awards.filter(x=>x==="Balón de Oro").length,caps:state.totals.internationalCaps,goals:state.totals.goals,assists:state.totals.assists,minutes:state.seasons.reduce((n,x)=>n+x.minutes,0),legacy:state.legacyScore,careerEarnings:state.careerEarnings,finalSalary:state.currentAnnualSalary,risks:decisionRisks.length,favorable,blockDelta};
}
const runCount=Math.max(1,Number(process.argv[2]??250));
const runs=[];for(let seed=1;seed<=runCount;seed++)runs.push(run(seed,Object.keys(strategies)[(seed-1)%5]));
const mean=(xs,key)=>Math.round(xs.reduce((n,x)=>n+x[key],0)/xs.length*100)/100;
const summarize=(xs)=>({runs:xs.length,peakOverall:mean(xs,"peakOverall"),peakAge:mean(xs,"peakAge"),finalOverall:mean(xs,"finalOverall"),titles:mean(xs,"titles"),domestic:Math.round(xs.reduce((n,x)=>n+x.titleKinds.domestic,0)/xs.length*100)/100,cups:Math.round(xs.reduce((n,x)=>n+x.titleKinds.cup,0)/xs.length*100)/100,continental:Math.round(xs.reduce((n,x)=>n+x.titleKinds.continental,0)/xs.length*100)/100,international:Math.round(xs.reduce((n,x)=>n+x.titleKinds.international,0)/xs.length*100)/100,individualAwards:mean(xs,"awards"),ballonDor:mean(xs,"ballonDor"),transfers:mean(xs,"transfers"),caps:mean(xs,"caps"),goals:mean(xs,"goals"),assists:mean(xs,"assists"),legacy:mean(xs,"legacy"),careerEarnings:mean(xs,"careerEarnings"),finalSalary:mean(xs,"finalSalary"),riskDecisions:mean(xs,"risks"),riskSuccessPct:Math.round(xs.reduce((n,x)=>n+x.favorable,0)/Math.max(1,xs.reduce((n,x)=>n+x.risks,0))*1000)/10,blockDelta:Object.fromEntries(["technical","physical","mentality","form"].map(k=>[k,Math.round(xs.reduce((n,x)=>n+x.blockDelta[k],0)/xs.length*100)/100]))});
console.log(JSON.stringify({overall:summarize(runs),byStrategy:Object.fromEntries(Object.keys(strategies).map(k=>[k,summarize(runs.filter(x=>x.strategy===k))])),byTalent:Object.fromEntries(["normal","high","crack","generational"].map(k=>[k,summarize(runs.filter(x=>x.talent===k))])),examples:Object.fromEntries(Object.keys(strategies).map(k=>[k,runs.find(x=>x.strategy===k)]))},null,2));
