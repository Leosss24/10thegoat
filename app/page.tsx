import Link from "next/link";
import GameCard from "@/components/GameCard";
import { games } from "@/data/games";

export default function HomePage() {
  return (
    <main>
      <section className="hero container">
        <div className="hero-brand-banner-wrap"><img className="hero-brand-banner" src="/brand/10thegoat-home-banner-fade.png" alt="10theGOAT · Juegos de fútbol online" /></div>
        <div className="eyebrow">Beta pública</div>
        <h1>El fútbol también se juega aquí.</h1>
        <p>Retos y minijuegos de fútbol para demostrar cuánto sabes. Esta primera Beta ya incluye tres juegos y seguirá creciendo.</p>
        <div className="actions">
          <Link className="btn btn-primary" href="/juegos">Jugar ahora</Link>
          <Link className="btn" href="/beta">Qué incluye la Beta</Link>
        </div>
      </section>
      <section className="section container">
        <div className="section-heading-row"><div><span className="eyebrow">Beta 0.11</span><h2>Juegos</h2></div><Link className="text-link" href="/juegos">Ver todos →</Link></div>
        <div className="grid">{games.map((game) => <GameCard key={game.slug} game={game} />)}</div>
      </section>
    </main>
  );
}
