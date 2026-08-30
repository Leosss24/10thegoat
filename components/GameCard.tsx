import Link from "next/link";

export default function GameCard({ game }: { game: { slug: string; title: string; icon: string; description: string; status: string } }) {
  return (
    <Link href={`/juegos/${game.slug}`} className="card">
      <div>
        <div className="icon">{game.icon}</div>
        <h3>{game.title}</h3>
        <p>{game.description}</p>
      </div>
      <span className="tag">{game.status}</span>
    </Link>
  );
}
