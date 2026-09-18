"use client";
import { useState } from "react";
import facts from "@/data/football-facts.json";

export default function DidYouKnow(){
  const [index,setIndex]=useState(()=>Math.floor(Math.random()*facts.length));
  const fact=facts[index];
  function next(){setIndex((current)=>{let candidate=current;while(candidate===current)candidate=Math.floor(Math.random()*facts.length);return candidate;});}
  return <section className="dyk" aria-labelledby="dyk-title"><div><span className="eyebrow">100 historias del fútbol</span><h2 id="dyk-title">¿Sabías que…?</h2><p>{fact.fact}</p><a href={fact.url} target="_blank" rel="noopener noreferrer">Fuente: {fact.source}</a></div><button type="button" onClick={next}>Otro dato ↻</button></section>;
}
