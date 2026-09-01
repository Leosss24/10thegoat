import Link from "next/link";

type ArenaGame = { slug: string; title: string; description: string; status: string };

const portalOrder = ["adivina-escudo", "mi-once", "adivina-jugador", "mayor-o-menor", "carrera", "football-grid"];

export default function ArenaGameMenu({ games, locale, label }: { games: ArenaGame[]; locale: string; label: string }) {
  const ordered = portalOrder.map((slug) => games.find((game) => game.slug === slug)).filter((game): game is ArenaGame => Boolean(game));
  const career = games.find((game) => game.slug === "carrera");

  return (
    <section className="arena-menu" aria-label={label}>
      <div className="arena-menu-scroll">
        <div className="arena-stage">
          <img className="arena-stage-image" src="/brand/10thegoat-arena-hero.png" alt="" />
          <div className="arena-stage-shade" aria-hidden="true" />
          {ordered.map((game, index) => (
            <Link
              key={game.slug}
              href={`/${locale}/juegos/${game.slug}`}
              className={`arena-portal arena-portal--${index + 1} arena-portal--${game.slug}`}
              aria-label={`${game.title}. ${game.status}`}
            >
              <span className="arena-portal-copy"><strong>{game.title}</strong><small>{game.status}</small></span>
            </Link>
          ))}
          {career && <Link href={`/${locale}/juegos/carrera`} className="arena-core" aria-label={`${career.title}. ${career.status}`}><span><strong>{career.title}</strong><small>{career.status}</small></span></Link>}
        </div>
      </div>
      <p className="arena-menu-hint">{label}</p>
    </section>
  );
}
