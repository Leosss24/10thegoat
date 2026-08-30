"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type PlayerRow = {
  id: number;
  display_name: string;
  birth_date: string | null;
  nationality_country_id: number | null;
  primary_position: string | null;
  preferred_foot: "left" | "right" | "both" | null;
  photo_url: string | null;
  is_active: boolean;
};

type ClubRow = {
  id: number;
  name: string;
  badge_url: string | null;
  is_national_team: boolean;
};

type CountryRow = { id: number; name: string; flag_emoji: string | null };
type CareerRow = { player_id: number; club_id: number; season_start_year: number };

type MysteryPlayer = {
  id: number;
  name: string;
  photoUrl: string | null;
  country: string;
  flag: string;
  club: string;
  clubBadge: string | null;
  position: string;
  foot: string;
  age: number;
};

type GuessResult = {
  player: MysteryPlayer;
  country: "correct" | "wrong";
  club: "correct" | "wrong";
  position: "correct" | "close" | "wrong";
  foot: "correct" | "wrong";
  age: "correct" | "close" | "wrong";
  ageDirection: "up" | "down" | null;
};

const MAX_GUESSES = 8;
const WINS_KEY = "10tg-mystery-wins";
const PLAYED_KEY = "10tg-mystery-played";

function ageFromBirthDate(value: string | null) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age;
}

function normalizePosition(value: string | null) {
  const p = (value ?? "").toLowerCase();
  if (p.includes("goal") || p.includes("keeper")) return "Portero";
  if (p.includes("def")) return "Defensa";
  if (p.includes("mid")) return "Centrocampista";
  if (p.includes("att") || p.includes("forward")) return "Delantero";
  return value || "Desconocida";
}

function positionFamily(value: string) {
  if (value === "Portero") return 0;
  if (value === "Defensa") return 1;
  if (value === "Centrocampista") return 2;
  if (value === "Delantero") return 3;
  return 9;
}

function footLabel(value: string | null) {
  if (value === "left") return "Izquierda";
  if (value === "right") return "Derecha";
  if (value === "both") return "Ambos";
  return "Desconocido";
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export default function MysteryPlayerGame() {
  const [pool, setPool] = useState<MysteryPlayer[]>([]);
  const [target, setTarget] = useState<MysteryPlayer | null>(null);
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [wins, setWins] = useState(0);
  const [played, setPlayed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWins(Number(localStorage.getItem(WINS_KEY) ?? 0) || 0);
    setPlayed(Number(localStorage.getItem(PLAYED_KEY) ?? 0) || 0);
  }, []);

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setError("Falta la configuración pública de Supabase en .env.local.");
        setLoading(false);
        return;
      }

      const [playersRes, clubsRes, countriesRes, careerRes] = await Promise.all([
        supabase
          .from("players")
          .select("id,display_name,birth_date,nationality_country_id,primary_position,preferred_foot,photo_url,is_active")
          .eq("is_active", true),
        supabase.from("clubs").select("id,name,badge_url,is_national_team"),
        supabase.from("countries").select("id,name,flag_emoji"),
        supabase
          .from("player_club_seasons")
          .select("player_id,club_id,season_start_year")
          .order("season_start_year", { ascending: false }),
      ]);

      const firstError = playersRes.error || clubsRes.error || countriesRes.error || careerRes.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const players = (playersRes.data ?? []) as PlayerRow[];
      const clubs = (clubsRes.data ?? []) as ClubRow[];
      const countries = (countriesRes.data ?? []) as CountryRow[];
      const career = (careerRes.data ?? []) as CareerRow[];
      const clubMap = new Map(clubs.map((club) => [club.id, club]));
      const countryMap = new Map(countries.map((country) => [country.id, country]));
      const latestClub = new Map<number, ClubRow>();

      for (const row of career) {
        if (latestClub.has(row.player_id)) continue;
        const club = clubMap.get(row.club_id);
        if (club && !club.is_national_team) latestClub.set(row.player_id, club);
      }

      const ready: MysteryPlayer[] = players.flatMap((player) => {
        const age = ageFromBirthDate(player.birth_date);
        const country = player.nationality_country_id
          ? countryMap.get(player.nationality_country_id)
          : null;
        const club = latestClub.get(player.id);
        if (age === null || !country || !club || !player.primary_position) return [];

        return [{
          id: player.id,
          name: player.display_name,
          photoUrl: player.photo_url,
          country: country.name,
          flag: country.flag_emoji ?? "🌍",
          club: club.name,
          clubBadge: club.badge_url,
          position: normalizePosition(player.primary_position),
          foot: footLabel(player.preferred_foot),
          age,
        }];
      });

      if (ready.length < 10) {
        setError("No hay suficientes jugadores activos completos para iniciar Jugador Misterioso.");
        setLoading(false);
        return;
      }

      setPool(ready);
      setTarget(randomItem(ready));
      setLoading(false);
    }

    load();
  }, []);

  const suggestions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    if (term.length < 2 || finished) return [];
    const guessedIds = new Set(guesses.map((guess) => guess.player.id));
    return pool
      .filter((player) => !guessedIds.has(player.id) && player.name.toLocaleLowerCase("es").includes(term))
      .sort((a, b) => {
        const aStarts = a.name.toLocaleLowerCase("es").startsWith(term) ? 0 : 1;
        const bStarts = b.name.toLocaleLowerCase("es").startsWith(term) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 7);
  }, [pool, query, guesses, finished]);

  function compare(player: MysteryPlayer): GuessResult {
    if (!target) throw new Error("No target");
    const ageDiff = Math.abs(player.age - target.age);
    const posDiff = Math.abs(positionFamily(player.position) - positionFamily(target.position));

    return {
      player,
      country: player.country === target.country ? "correct" : "wrong",
      club: player.club === target.club ? "correct" : "wrong",
      position: player.position === target.position ? "correct" : posDiff === 1 ? "close" : "wrong",
      foot: player.foot === target.foot ? "correct" : "wrong",
      age: player.age === target.age ? "correct" : ageDiff <= 2 ? "close" : "wrong",
      ageDirection: player.age === target.age ? null : player.age < target.age ? "up" : "down",
    };
  }

  function finishGame(isWin: boolean) {
    setFinished(true);
    setWon(isWin);
    const nextPlayed = played + 1;
    setPlayed(nextPlayed);
    localStorage.setItem(PLAYED_KEY, String(nextPlayed));
    if (isWin) {
      const nextWins = wins + 1;
      setWins(nextWins);
      localStorage.setItem(WINS_KEY, String(nextWins));
    }
  }

  function submitGuess(event: FormEvent) {
    event.preventDefault();
    if (!target || finished) return;

    const player =
      pool.find((item) => item.id === selectedId) ??
      pool.find((item) => item.name.toLocaleLowerCase("es") === query.trim().toLocaleLowerCase("es"));
    if (!player || guesses.some((guess) => guess.player.id === player.id)) return;

    const result = compare(player);
    const next = [...guesses, result];
    setGuesses(next);
    setQuery("");
    setSelectedId(null);

    if (player.id === target.id) finishGame(true);
    else if (next.length >= MAX_GUESSES) finishGame(false);
  }

  function choose(player: MysteryPlayer) {
    setQuery(player.name);
    setSelectedId(player.id);
  }

  function restart() {
    if (!pool.length) return;
    let next = randomItem(pool);
    if (target && pool.length > 1) {
      while (next.id === target.id) next = randomItem(pool);
    }
    setTarget(next);
    setGuesses([]);
    setQuery("");
    setSelectedId(null);
    setFinished(false);
    setWon(false);
  }

  if (loading) return <div className="wm-status">Preparando el vestuario…</div>;
  if (error || !target) {
    return <div className="wm-status wm-error"><strong>No se puede iniciar la partida.</strong><span>{error}</span></div>;
  }

  return (
    <section className="wm-game" aria-label="Jugador Misterioso">
      <div className="wm-topbar">
        <div><span>Intentos</span><strong>{guesses.length}/{MAX_GUESSES}</strong></div>
        <div><span>Victorias</span><strong>{wins}</strong></div>
        <div><span>Partidas</span><strong>{played}</strong></div>
      </div>

      <div className="wm-help">
        Adivina el futbolista. <b>Verde</b> significa coincidencia, <b>amarillo</b> indica que estás cerca.
        En la edad, la flecha señala si el jugador secreto es mayor o menor.
      </div>

      <form className="wm-search" onSubmit={submitGuess}>
        <div className="wm-searchbox">
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelectedId(null); }}
            placeholder="Escribe un jugador…"
            autoComplete="off"
            disabled={finished}
            aria-label="Nombre del jugador"
          />
          {suggestions.length > 0 && (
            <div className="wm-suggestions">
              {suggestions.map((player) => (
                <button type="button" key={player.id} onClick={() => choose(player)}>
                  {player.photoUrl ? <img src={player.photoUrl} alt="" /> : <span>⚽</span>}
                  <strong>{player.name}</strong>
                  <small>{player.club}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="wm-submit" type="submit" disabled={finished || query.trim().length < 2}>Probar</button>
      </form>

      <div className="wm-table-wrap">
        <div className="wm-grid wm-grid-head">
          <span>Jugador</span><span>País</span><span>Club</span><span>Posición</span><span>Pie</span><span>Edad</span>
        </div>
        <div className="wm-guesses">
          {guesses.length === 0 && <div className="wm-empty">Tienes ocho disparos. Que empiece la cacería. ⚽</div>}
          {[...guesses].reverse().map((guess) => (
            <div className="wm-grid wm-row" key={guess.player.id}>
              <div className="wm-player">
                {guess.player.photoUrl ? <img src={guess.player.photoUrl} alt="" /> : <span>⚽</span>}
                <strong>{guess.player.name}</strong>
              </div>
              <Cell state={guess.country}><span className="wm-flag">{guess.player.flag}</span>{guess.player.country}</Cell>
              <Cell state={guess.club}>
                {guess.player.clubBadge && <img className="wm-badge" src={guess.player.clubBadge} alt="" />}
                {guess.player.club}
              </Cell>
              <Cell state={guess.position}>{guess.player.position}</Cell>
              <Cell state={guess.foot}>{guess.player.foot}</Cell>
              <Cell state={guess.age}>
                <strong>{guess.player.age}</strong>
                {guess.ageDirection === "up" && <span className="wm-arrow">↑</span>}
                {guess.ageDirection === "down" && <span className="wm-arrow">↓</span>}
              </Cell>
            </div>
          ))}
        </div>
      </div>

      {finished && (
        <div className={`wm-finish ${won ? "is-win" : "is-loss"}`}>
          <div className="wm-answer">
            {target.photoUrl ? <img src={target.photoUrl} alt="" /> : <span>⚽</span>}
            <div>
              <small>{won ? "¡GOOOL!" : "FINAL DEL PARTIDO"}</small>
              <strong>{won ? `Era ${target.name}` : `El jugador era ${target.name}`}</strong>
              <span>{target.flag} {target.country} · {target.club} · {target.position} · {target.age} años</span>
            </div>
          </div>
          <button className="wm-restart" onClick={restart}>Jugar otra</button>
        </div>
      )}
    </section>
  );
}

function Cell({ state, children }: { state: "correct" | "close" | "wrong"; children: React.ReactNode }) {
  return <div className={`wm-cell is-${state}`}>{children}</div>;
}
