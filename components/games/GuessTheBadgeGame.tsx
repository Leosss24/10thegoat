"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getGameScore, recordGameResult } from "../../lib/game-scores";
import { readGameSession, writeGameSession } from "../../lib/game-session";
import { useI18n } from "../I18nProvider";
import { uniqueSeniorBadges } from "../../lib/football/club-filter";

type Club = { id: number; name: string; badge_url: string | null; is_national_team: boolean; is_active: boolean; is_game_eligible: boolean };
type Attempt = { id: number; name: string; correct: boolean };

const MAX_ATTEMPTS = 6;
const GAME_KEY = "adivina-escudo";
const SCORE_BY_ATTEMPT = [100, 80, 60, 40, 30, 20];
const PIXEL_RESOLUTIONS = [8, 12, 18, 28, 44, 72, 260];

type BadgeSession = {
  targetId: number;
  attempts: Attempt[];
  query: string;
  selectedId: number | null;
  finished: boolean;
  won: boolean;
  roundScore: number;
};

function isBadgeSession(value: unknown): value is BadgeSession {
  if (!value || typeof value !== "object") return false;
  const session = value as BadgeSession;
  return Number.isInteger(session.targetId) && Array.isArray(session.attempts) && session.attempts.length <= MAX_ATTEMPTS &&
    session.attempts.every((attempt) => attempt && Number.isInteger(attempt.id) && typeof attempt.name === "string" && typeof attempt.correct === "boolean") &&
    typeof session.query === "string" && (session.selectedId === null || Number.isInteger(session.selectedId)) &&
    typeof session.finished === "boolean" && typeof session.won === "boolean" &&
    Number.isFinite(session.roundScore) && session.roundScore >= 0;
}

function pickRandom<T>(items: T[]) { return items[Math.floor(Math.random() * items.length)]; }
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export default function GuessTheBadgeGame() {
  const { locale } = useI18n();
  const c = locale === "en" ? { config: "Public Supabase configuration is missing.", few: "There are not enough clubs with badges.", loading: "Finding a badge…", attempt: "Attempt", of: "of", revealed: "Badge revealed", question: "Which club is it?", badgeOf: "Badge of", pixelated: "Pixelated club badge", resolution: "Visible resolution", complete: "full", placeholder: "Type a club…", try: "Try", won: "BADGE GUESSED!", was: "THE CLUB WAS", points: "points", total: "Total", again: "Play again" } : locale === "fr" ? { config: "La configuration publique de Supabase est manquante.", few: "Il n'y a pas assez de clubs avec un écusson.", loading: "Recherche d'un écusson…", attempt: "Essai", of: "sur", revealed: "Écusson dévoilé", question: "Quel est ce club ?", badgeOf: "Écusson de", pixelated: "Écusson de club pixelisé", resolution: "Résolution visible", complete: "complète", placeholder: "Saisissez un club…", try: "Essayer", won: "ÉCUSSON DEVINÉ !", was: "LE CLUB ÉTAIT", points: "points", total: "Total", again: "Rejouer" } : { config: "Falta la configuración pública de Supabase.", few: "No hay suficientes clubes con escudo.", loading: "Buscando un escudo…", attempt: "Intento", of: "de", revealed: "Escudo revelado", question: "¿Qué club es?", badgeOf: "Escudo de", pixelated: "Escudo de club pixelado", resolution: "Resolución visible", complete: "completa", placeholder: "Escribe un club…", try: "Probar", won: "¡ESCUDO ADIVINADO!", was: "EL CLUB ERA", points: "puntos", total: "Total", again: "Jugar otra" };
  const [clubs, setClubs] = useState<Club[]>([]);
  const [target, setTarget] = useState<Club | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionLockRef = useRef(false);

  useEffect(() => {
    setTotalPoints(getGameScore(GAME_KEY).points);
  }, []);

  useEffect(() => {
    async function load() {
      if (!supabase) { setError(c.config); setLoading(false); return; }
      const all:Club[]=[];
      for(let from=0;;from+=1000){
        const { data, error } = await supabase.from("clubs").select("id,name,badge_url,is_national_team,is_active,is_game_eligible").eq("is_national_team", false).eq("is_game_eligible", true).eq("is_active", true).not("badge_url", "is", null).order("name").range(from,from+999);
        if (error) { setError(error.message); setLoading(false); return; }
        all.push(...((data??[]) as Club[]));
        if((data?.length??0)<1000)break;
      }
      const ready = uniqueSeniorBadges(all.filter(club=>club.name.length>1));
      if (ready.length < 10) { setError(c.few); setLoading(false); return; }
      setClubs(ready);
      const saved = readGameSession(GAME_KEY, isBadgeSession);
      const savedTarget = saved && ready.find((club) => club.id === saved.targetId);
      setTarget(savedTarget ?? pickRandom(ready));
      if (saved && savedTarget) {
        const validIds = new Set(ready.map((club) => club.id));
        const restoredAttempts = saved.attempts.filter((attempt) => validIds.has(attempt.id));
        setAttempts(restoredAttempts);
        setQuery(saved.query);
        setSelectedId(saved.selectedId && validIds.has(saved.selectedId) ? saved.selectedId : null);
        setFinished(saved.finished);
        setWon(saved.won);
        setRoundScore(saved.roundScore);
        actionLockRef.current = saved.finished;
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (loading || !target) return;
    writeGameSession(GAME_KEY, { targetId: target.id, attempts, query, selectedId, finished, won, roundScore } satisfies BadgeSession);
  }, [loading, target, attempts, query, selectedId, finished, won, roundScore]);

  const suggestions = useMemo(() => {
    const term = normalize(query);
    if (term.length < 2 || finished) return [];
    const used = new Set(attempts.map((a) => a.id));
    return clubs
      .filter((club) => !used.has(club.id) && normalize(club.name).includes(term))
      .sort((a, b) => Number(!normalize(a.name).startsWith(term)) - Number(!normalize(b.name).startsWith(term)) || a.name.localeCompare(b.name))
      .slice(0, 7);
  }, [clubs, query, attempts, finished]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!target || finished || actionLockRef.current) return;
    const club = clubs.find((c) => c.id === selectedId) ?? clubs.find((c) => normalize(c.name) === normalize(query));
    if (!club || attempts.some((a) => a.id === club.id)) return;
    actionLockRef.current = true;
    const correct = club.id === target.id;
    const next = [...attempts, { id: club.id, name: club.name, correct }];
    setAttempts(next);
    setQuery("");
    setSelectedId(null);
    if (correct) {
      const scoreValue = SCORE_BY_ATTEMPT[next.length - 1] ?? 0;
      const score = recordGameResult(GAME_KEY, { score: scoreValue, won: true });
      setRoundScore(scoreValue);
      setTotalPoints(score.points);
      setWon(true);
      setFinished(true);
    } else if (next.length >= MAX_ATTEMPTS) {
      const score = recordGameResult(GAME_KEY, { score: 0, won: false });
      setRoundScore(0);
      setTotalPoints(score.points);
      setFinished(true);
    } else {
      window.setTimeout(() => { actionLockRef.current = false; }, 0);
    }
  }

  function restart() {
    if (!clubs.length) return;
    let next = pickRandom(clubs);
    if (target && clubs.length > 1) while (next.id === target.id) next = pickRandom(clubs);
    actionLockRef.current = false;
    setTarget(next); setAttempts([]); setQuery(""); setSelectedId(null); setFinished(false); setWon(false); setRoundScore(0);
  }

  const pixelResolution = PIXEL_RESOLUTIONS[Math.min(finished ? PIXEL_RESOLUTIONS.length - 1 : attempts.length, PIXEL_RESOLUTIONS.length - 1)];

  useEffect(() => {
    if (!target?.badge_url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = new Image();
    image.onload = () => {
      const small = document.createElement("canvas");
      small.width = pixelResolution;
      small.height = pixelResolution;
      const smallCtx = small.getContext("2d");
      if (!smallCtx) return;

      smallCtx.clearRect(0, 0, pixelResolution, pixelResolution);
      smallCtx.imageSmoothingEnabled = true;
      const ratio = Math.min(pixelResolution / image.width, pixelResolution / image.height);
      const w = image.width * ratio;
      const h = image.height * ratio;
      smallCtx.drawImage(image, (pixelResolution - w) / 2, (pixelResolution - h) / 2, w, h);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    };
    image.src = target.badge_url;
  }, [target, pixelResolution]);

  if (loading) return <div className="badge-status" role="status" aria-live="polite">{c.loading}</div>;
  if (error || !target) return <div className="badge-status error" role="alert">{error}</div>;

  return (
    <section className="badge-game">
      <div className="badge-progress"><span>{c.attempt} {Math.min(attempts.length + 1, MAX_ATTEMPTS)} {c.of} {MAX_ATTEMPTS}</span><strong>{totalPoints} pts</strong></div>

      <div className="badge-layout">
        <div className="badge-scanner">
          <div className="pixel-frame">
            <canvas
              ref={canvasRef}
              width={260}
              height={260}
              className="pixel-canvas"
              aria-label={finished ? `${c.badgeOf} ${target.name}` : c.pixelated}
            />
          </div>
          <div className="pixel-caption">{c.resolution}: <b>{finished ? c.complete : `${pixelResolution}×${pixelResolution}`}</b></div>
        </div>

        <div className="badge-console">
          <strong className="badge-question">{finished ? c.revealed : c.question}</strong>
          <div className="badge-attempt-lights" aria-hidden="true">{Array.from({ length: MAX_ATTEMPTS }, (_, i) => <i className={i < attempts.length ? "is-active" : ""} key={i} />)}</div>
          <form className="badge-search" onSubmit={submit}>
            <div className="badge-searchbox">
              <input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }} disabled={finished} placeholder={c.placeholder} autoComplete="off" aria-label={c.placeholder} aria-autocomplete="list" aria-expanded={suggestions.length > 0} aria-controls="badge-suggestions" />
              {suggestions.length > 0 && (
                <div className="badge-suggestions" id="badge-suggestions" role="listbox">
                  {suggestions.map((club) => <button type="button" role="option" aria-selected={selectedId === club.id} key={club.id} onClick={() => { setQuery(club.name); setSelectedId(club.id); }}><img src={club.badge_url!} alt="" /><span>{club.name}</span></button>)}
                </div>
              )}
            </div>
            <button type="submit" disabled={finished || query.trim().length < 2}>{c.try}</button>
          </form>

          <div className="badge-attempts">
            {Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
              const attempt = attempts[i];
              return <div className={`badge-attempt ${attempt ? (attempt.correct ? "correct" : "wrong") : "empty"}`} key={i}><span>{i + 1}</span><strong>{attempt?.name ?? "—"}</strong><b>{attempt ? (attempt.correct ? "✓" : "×") : ""}</b></div>;
            })}
          </div>
        </div>
      </div>

      {finished && (
        <div className={`badge-result ${won ? "win" : "loss"}`}>
          <div>
            <small>{won ? c.won : c.was}</small>
            <strong>{target.name}</strong>
            <span>{won ? `+${roundScore} ${c.points}` : `0 ${c.points}`} · {c.total}: {totalPoints} pts</span>
          </div>
          <button type="button" onClick={restart}>{c.again}</button>
        </div>
      )}
    </section>
  );
}
