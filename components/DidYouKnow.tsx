"use client";
import { useState } from "react";
import facts from "@/data/football-facts.json";

export default function DidYouKnow(){
  const [index,setIndex]=useState(()=>Math.floor(Math.random()*facts.length));
  const fact=facts[index];
  const words=fact.fact.toUpperCase().split(" ");
  function next(){setIndex((current)=>{let candidate=current;while(candidate===current)candidate=Math.floor(Math.random()*facts.length);return candidate;});}
  return <section className="dyk dyk-scoreboard" aria-labelledby="dyk-title">
    <header className="scoreboard-head"><div><span className="scoreboard-live" aria-hidden="true"></span><span id="dyk-title">10THEGOAT · ¿SABÍAS QUE...?</span></div><span>{String(index+1).padStart(2,"0")} / {facts.length}</span></header>
    <div className="scoreboard-display" key={index} role="text" aria-label={fact.fact}>
      <div className="scoreboard-letters" aria-hidden="true">{words.map((word,wordIndex)=>{const offset=words.slice(0,wordIndex).reduce((total,item)=>total+item.length+1,0);return <span className="scoreboard-word" key={`${word}-${wordIndex}`}>{word.split("").map((letter,letterIndex)=><span className="scoreboard-character" style={{animationDelay:`${Math.min((offset+letterIndex)*14,850)}ms`}} key={letterIndex}>{letter}</span>)}</span>})}</div>
    </div>
    <footer className="scoreboard-foot"><a href={fact.url} target="_blank" rel="noopener noreferrer">FUENTE · {fact.source}</a><button type="button" onClick={next}>OTRO DATO <span aria-hidden="true">↻</span></button></footer>
  </section>;
}
