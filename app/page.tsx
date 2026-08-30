import Link from "next/link";
import GameCard from "@/components/GameCard";
import { games } from "@/data/games";

export default function HomePage() {
  return (
    <main>
      <section className="hero container">
        <div className="eyebrow">10thegoat.com</div>
        <h1>El fútbol también se juega aquí.</h1>
        <p>Retos diarios, minijuegos y un simulador de carrera pensado para quienes saben demasiado de fútbol y quieren demostrarlo.</p>
        <div className="actions">
          <Link className="btn btn-primary" href="/juegos">Ver juegos</Link>
          <Link className="btn" href="/juegos/carrera">Modo Carrera</Link>
        </div>
      </section>
      <section className="section container">
        <h2>Juegos</h2>
        <div className="grid">{games.map((game) => <GameCard key={game.slug} game={game} />)}</div>
      </section>
    </main>
  );
}
