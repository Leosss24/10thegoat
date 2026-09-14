/** Build a public, static badge bank. No credentials or database writes. */
import fs from 'node:fs';
import { uniqueSeniorBadges } from '../lib/football/club-filter.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const rows=read('tmp/content-audit/clubs.json'), results=read('tmp/content-audit/team-results.json');
const excluded=new Set(read('data/badges/excluded.json').clubIds);
const providerId=url=>Number(url?.match(/teams\/(\d+)\./)?.[1]);
const existing=new Map(rows.filter(c=>c.badge_url).map(c=>[providerId(c.badge_url),c]));
const bank=new Map();const coverage=[];
for(const c of rows.filter(c=>c.is_active&&c.is_game_eligible&&!c.is_national_team&&c.badge_url))bank.set(c.id,{id:c.id,name:c.name,badge_url:c.badge_url,is_national_team:false,is_active:true,is_game_eligible:true,country:null,leagueId:null,season:null,source:'existing-club-catalog'});
for(const entry of results){let added=0;const valid=uniqueSeniorBadges(entry.teams.filter(x=>!x.team.national).map(x=>({name:x.team.name,badge_url:x.team.logo,team:x.team})));
for(const {team} of valid){const old=existing.get(team.id);const id=old?.id??1000000000+team.id;
bank.set(id,{id,name:old?.name||team.name,badge_url:team.logo,is_national_team:false,is_active:true,is_game_eligible:true,country:entry.country,leagueId:entry.id,season:entry.season,providerId:team.id,source:entry.id?'first-division':'country-catalog'});added++;}
if(added)coverage.push({country:entry.country,leagueId:entry.id,league:entry.name,season:entry.season,teams:added});}
for(const c of read('data/badges/supplements.json')){bank.set(c.id,{...c,is_national_team:false,is_active:true,is_game_eligible:true,leagueId:null,season:null});coverage.push({country:c.country,leagueId:null,league:'Official club website',season:null,teams:1,source:c.source});}
const clubs=uniqueSeniorBadges([...bank.values()]).filter(club=>!excluded.has(club.id)).sort((a,b)=>a.name.localeCompare(b.name));
fs.writeFileSync('data/badges/catalog.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),source:'https://www.api-football.com/documentation-v3#tag/Teams',clubs},null,2)+'\n');
fs.writeFileSync('data/badges/coverage.json',JSON.stringify({exportedAt:new Date().toISOString(),clubs:clubs.length,coverage,notes:['League seasons are recorded per country; some American competitions use the latest available 2025 season.','Liechtenstein has no domestic league; senior clubs are included via the country catalog.','Countries without league coverage use the provider country catalog, rather than invented league memberships.','Existing eligible senior clubs are retained so saved targets continue to resolve.']},null,2)+'\n');
console.log('Playable badges',clubs.length,'countries',new Set(coverage.map(c=>c.country)).size,'leagues',coverage.filter(c=>c.leagueId).length);
