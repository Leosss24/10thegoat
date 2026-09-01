"use client";

import Link from "next/link";
import { useState } from "react";

type ArenaGame = { slug: string; title: string; description: string; status: string };

const portalOrder = ["adivina-escudo", "mi-once", "adivina-jugador", "mayor-o-menor", "carrera", "football-grid"];

export default function ArenaGameMenu({ games, locale, label }: { games: ArenaGame[]; locale: string; label: string }) {
  const ordered = portalOrder.map((slug) => games.find((game) => game.slug === slug)).filter((game): game is ArenaGame => Boolean(game));
  const career = games.find((game) => game.slug === "carrera");
  const [activeGame, setActiveGame] = useState<{ game: ArenaGame; color: number } | null>(null);

  return (
    <section className="arena-menu" aria-label={label}>
      <div className="arena-menu-scroll">
        <div className="arena-stage">
          <img className="arena-stage-image" src="/brand/10thegoat-arena-hero.png" alt="" />
          <div className="arena-stage-shade" aria-hidden="true" />
          <div className={`arena-game-display${activeGame ? ` arena-game-display--${activeGame.color} is-visible` : ""}`} aria-live="polite">
            {activeGame && <><strong>{activeGame.game.title}</strong><small>{activeGame.game.description}</small></>}
          </div>
          {ordered.map((game, index) => (
            <Link
              key={game.slug}
              href={`/${locale}/juegos/${game.slug}`}
              className={`arena-portal arena-portal--${index + 1} arena-portal--${game.slug}`}
              aria-label={`${game.title}. ${game.status}`}
              onMouseEnter={() => setActiveGame({ game, color: index + 1 })}
              onMouseLeave={() => setActiveGame(null)}
              onFocus={() => setActiveGame({ game, color: index + 1 })}
              onBlur={() => setActiveGame(null)}
            >
              <span className="arena-portal-light" aria-hidden="true" />
            </Link>
          ))}
          {career && <Link href={`/${locale}/juegos/carrera`} className="arena-core" aria-label={`${career.title}. ${career.status}`} onMouseEnter={() => setActiveGame({ game: career, color: 7 })} onMouseLeave={() => setActiveGame(null)} onFocus={() => setActiveGame({ game: career, color: 7 })} onBlur={() => setActiveGame(null)} />}
        </div>
      </div>
      <p className="arena-menu-hint">{label}</p>
    </section>
  );
}
