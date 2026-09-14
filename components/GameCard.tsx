import Link from "next/link";

export default function GameCard({ game, locale, className = "" }: { game: { slug: string; title: string; description: string; status: string }; locale: string; className?: string }) {
  return (
    <Link href={`/${locale}/juegos/${game.slug}`} className={`card game-card game-card--${game.slug} ${className}`} data-game={game.slug}>
      <div>
        <h3>{game.title}</h3>
        <p>{game.description}</p>
      </div>
      <span className="tag"><span>{game.status}</span><b aria-hidden="true">→</b></span>
    </Link>
  );
}
