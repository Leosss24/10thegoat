"use client";
import { recordBadgeFacts, badgeFact } from "../../lib/badges/client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../I18nProvider";
import { connectionPuzzles, legacyConnectionPuzzles, connectionsCopy } from "../../lib/connections/data";
import { newConnections, restoreConnections, selectConnection, checkConnection, nextConnections, type ConnectionsState } from "../../lib/connections/engine";
import { playerDisplayName, playerIdentity } from "../../lib/football/player-identity";
import { recordGameResult } from "../../lib/game-scores";
import "./ConnectionsGame.css";

const KEY = "10tg-game-session-v1:conexiones";
const allPuzzles = [...connectionPuzzles, ...legacyConnectionPuzzles];
export default function ConnectionsGame() {
  const { locale } = useI18n();
  const t = connectionsCopy[locale];
  const [state, setState] = useState<ConnectionsState | null>(null);
  const current = useRef<ConnectionsState | null>(null);
  const [message, setMessage] = useState<"correct" | "wrong" | "">("");
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let restored: ConnectionsState;
      try {
        const raw = sessionStorage.getItem(KEY);
        restored = restoreConnections(raw ? JSON.parse(raw)?.value : null, connectionPuzzles, legacyConnectionPuzzles) ?? newConnections(connectionPuzzles);
        sessionStorage.setItem(KEY, JSON.stringify({ version: 1, value: restored }));
      } catch { restored = newConnections(connectionPuzzles); setStorageFailed(true); }
      current.current = restored;
      setState(restored);
    });
    return () => { active = false; };
  }, []);
  function save(next: ConnectionsState) {
    current.current = next;
    setState(next);
    try { sessionStorage.setItem(KEY, JSON.stringify({ version: 1, value: next })); }
    catch { setStorageFailed(true); }
  }
  if (!state) return <div className="connections-panel" role="status">…</div>;
  const puzzle = allPuzzles.find(p => p.id === state.puzzleId)!;
  const members = puzzle.groups.flatMap(g => g.members);
  const remaining = state.order.filter(id => !puzzle.groups.some(g => state.solved.includes(g.id) && g.members.some(m => m.id === id)));
  function submit() {
    const result = checkConnection(current.current!, puzzle);
    if (result.state === current.current) return;
    save(result.state);
    setMessage(result.correct ? "correct" : "wrong");
    if (result.award) { recordGameResult("conexiones", result.award);
      if(result.award.won)recordBadgeFacts([badgeFact("connections",1,puzzle.id),...(result.state.mistakes===4?[badgeFact("connections-perfect")]:[])]);
    }
  }
  return <div className="connections-game">
    {storageFailed && <p className="connections-storage" role="status">{t.storage}</p>}
    <section className="connections-panel">
      <header><div><span>10theGOAT · 4×4</span><h2>{state.finished ? (state.solved.length === 4 ? t.won : t.lost) : t.intro}</h2></div>
        <dl><div><dt>{t.mistakes}</dt><dd>{"●".repeat(state.mistakes)}{"○".repeat(4 - state.mistakes)}</dd></div><div><dt>{t.solved}</dt><dd>{state.solved.length}/4</dd></div></dl>
      </header>
      <div className="connections-groups">{puzzle.groups.filter(g => state.solved.includes(g.id) || (state.finished && state.solved.length < 4)).map(g => <article key={g.id} className={state.solved.includes(g.id) ? "is-solved" : "is-revealed"}>
        <strong>{g.title[locale]}</strong><span>{g.members.map(m => playerDisplayName(m.playerId, m.label)).join(" · ")}</span><p>{g.reason[locale]}</p>
      </article>)}</div>
      {!state.finished && <div className="connections-grid" role="group" aria-label={t.intro}>{remaining.map(id => {
        const item = members.find(m => m.id === id)!;
        const label = playerDisplayName(item.playerId, item.label);
        const photo = playerIdentity(item.playerId)?.photo_url || item.photo_url;
        return <button type="button" aria-pressed={state.selected.includes(id)} className={state.selected.includes(id) ? "is-selected" : ""} onClick={() => { save(selectConnection(current.current!, puzzle, id)); setMessage(""); }} key={id}>
          <span className="connections-face" aria-hidden="true"><span>{label.split(/\s+/).map(s => s[0]).slice(0, 2).join("")}</span>{photo && <img src={photo} alt="" loading="lazy" decoding="async" width={72} height={72} onError={event => { event.currentTarget.hidden = true; }} />}</span>
          <span className="connections-player-name">{label}</span>
        </button>;
      })}</div>}
      <div className="connections-feedback" aria-live="polite">{message ? t[message] : ""}</div>
      {state.finished ? <div className="connections-finish"><strong>{t.points}: {state.solved.length === 4 ? 400 - (4 - state.mistakes) * 50 : 0}</strong><button className="btn btn-primary" onClick={() => { save(nextConnections(current.current!, connectionPuzzles)); setMessage(""); }}>{t.again}</button></div> :
        <div className="connections-actions"><span>{state.selected.length}/4 {t.selected}</span><button onClick={() => save({ ...current.current!, selected: [] })} disabled={!state.selected.length}>{t.clear}</button><button className="btn btn-primary" onClick={submit} disabled={state.selected.length !== 4}>{t.submit}</button></div>}
    </section>
    <details className="connections-rules"><summary>{t.rules}</summary><p>{t.rulesText}</p></details>
  </div>;
}
