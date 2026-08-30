import type { Metadata } from "next";
import GuessTheBadgeGame from "../../../components/games/GuessTheBadgeGame";

export const metadata: Metadata = { title: "Adivina el Escudo", description: "Reconoce el club mientras su escudo se desvela intento a intento." };

export default function Page() {
  return (
    <main className="game-shell container badge-page">
      <div className="badge-heading">
        <span className="eyebrow">Escudos de clubes</span>
        <h1>Adivina el escudo</h1>
        <p>El escudo empieza casi irreconocible. Cada fallo reduce el pixelado. Tienes seis intentos para descubrir el club.</p>
      </div>
      <GuessTheBadgeGame />
    </main>
  );
}
