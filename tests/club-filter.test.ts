import test from "node:test";
import assert from "node:assert/strict";
import { isReserveOrYouthClub, isWomensTeam, uniqueSeniorBadges } from "../lib/football/club-filter.ts";

test("reserve and youth naming conventions are rejected",()=>{
  for(const name of ["Jong Ajax","Jong PSV","Barcelona U19","Manchester City U21","Real Madrid Castilla","Bayern München II","Villarreal B","Juventus Next Gen","Inter Primavera"]){
    assert.equal(isReserveOrYouthClub(name),true,name);
  }
  for(const name of ["Ajax","PSV","Real Madrid","Inter","Young Boys","Willem II"]){
    assert.equal(isReserveOrYouthClub(name),false,name);
  }
});

test("senior badge list removes repeated image URLs",()=>{
  const clubs=[
    {name:"Ajax",badge_url:"https://media.example/1.png"},
    {name:"Jong Ajax",badge_url:"https://media.example/2.png"},
    {name:"Ajax duplicate",badge_url:"https://media.example/1.png?cache=2"},
    {name:"PSV",badge_url:"https://media.example/3.png"},
  ];
  assert.deepEqual(uniqueSeniorBadges(clubs).map(x=>x.name),["Ajax","PSV"]);
});

test("women teams are detected without rejecting legitimate W names",()=>{
  for(const name of ["Barcelona W","Chelsea Women","Arsenal Ladies","Bayern Frauen","Juventus Femminile","PSG Féminines","Ajax Vrouwen","Benfica Feminino","Roma WFC","Barcelona F"]){
    assert.equal(isWomensTeam(name),true,name);
  }
  for(const name of ["Barcelona","W Connection","Willem II","Wacker Innsbruck","Sheffield Wednesday"]){
    assert.equal(isWomensTeam(name),false,name);
  }
});
