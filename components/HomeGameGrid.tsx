import Link from "next/link";
import GameCard from "./GameCard";

type Game = {
  slug: string;
  title: string;
  description: string;
  status: string;
};

export default function HomeGameGrid({
  games,
  locale,
  title,
  allGames,
}: {
  games: Game[];
  locale: string;
  title: string;
  allGames: string;
}) {
  const career = games.find((game) => game.slug === "carrera");
  const remaining = games.filter((game) => game.slug !== "carrera");

  return (
    <section className="home-locker-room" id="juegos" aria-labelledby="home-games-title">
      <div className="container home-locker-inner">
        <header className="home-locker-heading">
          <div>
            <h2 id="home-games-title">{title}</h2>
          </div>
          <Link href={`/${locale}/juegos`}>
            {allGames} <b aria-hidden="true">→</b>
          </Link>
        </header>

        <div className="home-locker-layout">
          {career && (
            <GameCard
              game={career}
              locale={locale}
              className="home-locker-card home-locker-card--career"
            />
          )}
          <div className="home-locker-grid">
            {remaining.map((game) => (
              <GameCard
                key={game.slug}
                game={game}
                locale={locale}
                className="home-locker-card"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="home-locker-bench" aria-hidden="true" />
    </section>
  );
}
