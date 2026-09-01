"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getGameScore, recordGameResult } from "../../lib/game-scores";
import { useI18n } from "../I18nProvider";

type Club = { id: number; name: string; badge_url: string | null; is_national_team: boolean; is_active: boolean; is_game_eligible: boolean };
type Attempt = { id: number; name: string; correct: boolean };

const MAX_ATTEMPTS = 6;
const GAME_KEY = "adivina-escudo";
const SCORE_BY_ATTEMPT = [100, 80, 60, 40, 30, 20];
const PIXEL_RESOLUTIONS = [8, 12, 18, 28, 44, 72, 260];

function pickRandom<T>(items: T[]) { return items[Math.floor(Math.random() * items.length)]; }
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function isReserveOrYouthClub(name: string) {
  const raw = name.trim();
  const folded = normalize(raw);

  // Sufijos/patrones habituales de filiales y equipos de desarrollo.
  if (/\b(?:u|under)[ -]?(?:17|18|19|20|21|23)\b/i.test(raw)) return true;
  if (/\b(?:reserves?|reserve|youth|academy|primavera)\b/i.test(raw)) return true;
  if (/\s(?:b|c|ii|iii)$/i.test(raw)) return true;
  if (/\b(?:b team|second team|2nd team)\b/i.test(raw)) return true;

  // Filiales con nombre propio que no llevan un sufijo obvio.
  const knownReserveNames = [
    "real madrid castilla",
    "barcelona atletic",
    "barca atletic",
    "villarreal b",
    "real sociedad b",
    "athletic club b",
    "bilbao athletic",
    "betis deportivo",
    "sevilla atletico",
    "atletico madrileno",
    "valencia mestalla",
    "espanyol b",
    "deportivo fabril",
    "celta fortuna",
    "bayern munich ii",
    "bayern munchen ii",
    "borussia dortmund ii",
    "mainz 05 ii",
    "freiburg ii",
    "werder bremen ii",
    "hannover 96 ii",
    "eintracht frankfurt ii",
    "juventus next gen",
    "atalanta u23",
    "milan futuro",
    "inter u23",
  ];
  return knownReserveNames.some((reserve) => folded === normalize(reserve));
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

  useEffect(() => {
    setTotalPoints(getGameScore(GAME_KEY).points);
  }, []);

  useEffect(() => {
    async function load() {
      if (!supabase) { setError(c.config); setLoading(false); return; }
      const { data, error } = await supabase
        .from("clubs")
        .select("id,name,badge_url,is_national_team,is_active,is_game_eligible")
        .eq("is_national_team", false)
        .eq("is_game_eligible", true)
        .eq("is_active", true)
        .not("badge_url", "is", null);
      if (error) { setError(error.message); setLoading(false); return; }
      const ready = ((data ?? []) as Club[]).filter((club) =>
        club.badge_url &&
        club.name.length > 1 &&
        !isReserveOrYouthClub(club.name)
      );
      if (ready.length < 10) { setError(c.few); setLoading(false); return; }
      setClubs(ready);
      setTarget(pickRandom(ready));
      setLoading(false);
    }
    load();
  }, []);

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
    if (!target || finished) return;
    const club = clubs.find((c) => c.id === selectedId) ?? clubs.find((c) => normalize(c.name) === normalize(query));
    if (!club || attempts.some((a) => a.id === club.id)) return;
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
    }
  }

  function restart() {
    if (!clubs.length) return;
    let next = pickRandom(clubs);
    if (target && clubs.length > 1) while (next.id === target.id) next = pickRandom(clubs);
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

  if (loading) return <div className="badge-status">{c.loading}</div>;
  if (error || !target) return <div className="badge-status error">{error}</div>;

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
              <input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }} disabled={finished} placeholder={c.placeholder} autoComplete="off" />
              {suggestions.length > 0 && (
                <div className="badge-suggestions">
                  {suggestions.map((club) => <button type="button" key={club.id} onClick={() => { setQuery(club.name); setSelectedId(club.id); }}><img src={club.badge_url!} alt="" /><span>{club.name}</span></button>)}
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
