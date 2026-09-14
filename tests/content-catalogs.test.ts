import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uniqueSeniorBadges } from '../lib/football/club-filter.ts';
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
test('badge bank has unique senior clubs and covers every planned league', () => {
  const clubs = read('../data/badges/catalog.json').clubs as {id:number;name:string;badge_url:string;is_national_team:boolean;leagueId:number|null}[];
  const excluded = new Set<number>(read('../data/badges/excluded.json').clubIds);
  const coverage = read('../data/badges/coverage.json').coverage as {country:string;leagueId:number|null}[];
  const leagues = read('../data/badges/leagues.json') as {id:number}[];
  assert.ok(clubs.length >= 1600);
  assert.equal(new Set(clubs.map(c=>c.id)).size,clubs.length);
  assert.equal(uniqueSeniorBadges(clubs).length,clubs.length);
  assert.ok(clubs.every(c=>!excluded.has(c.id)));
  assert.ok(clubs.every(c=>!c.is_national_team&&new URL(c.badge_url).protocol==='https:'));
  assert.ok(new Set(coverage.map(c=>c.country)).size>=90);
  for(const league of leagues){assert.ok(coverage.some(c=>c.leagueId===league.id));assert.ok(clubs.some(c=>c.leagueId===league.id));}
});
test('new Connections boards exclude known generic portraits and use database display names', () => {
  const excluded = new Set<number>(read('../data/connections/photo-audit.json').excludedPlayerIds);
  const players = new Map<number,{display_name:string}>(read('../data/players/catalog.json').players.map((p:{id:number})=>[p.id,p]));
  const boards = read('../data/connections/puzzles.json') as {groups:{members:{playerId:number;label:string}[]}[]}[];
  for(const board of boards)for(const group of board.groups)for(const member of group.members){assert.ok(!excluded.has(member.playerId));assert.equal(member.label,players.get(member.playerId)?.display_name.toUpperCase());}
});
test('Intruso contains 100 distinct sets with canonical uppercase player labels', () => {
  const bank = read('../data/odd-one-out/challenges.json') as {options:{id:string;playerId?:number;label:string}[]}[];
  const players = new Map<number,{display_name:string}>(read('../data/players/catalog.json').players.map((p:{id:number})=>[p.id,p]));
  assert.equal(bank.length,100);
  assert.equal(new Set(bank.map(c=>c.options.map(o=>o.label).sort().join('|'))).size,100);
  for(const c of bank)for(const o of c.options){assert.equal(o.label,o.label.toUpperCase());if(o.playerId)assert.equal(o.label,players.get(o.playerId)?.display_name.toUpperCase());}
});
