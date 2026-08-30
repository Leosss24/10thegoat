import type { Metadata } from "next";
import HigherLowerGame from "../../../components/games/HigherLowerGame";

export const metadata: Metadata = { title: "Mayor o Menor", description: "Compara goles de temporadas reales y encadena la mayor racha posible." };

export default function Page() {
  return (
    <main className="game-shell container hl-page">
      <div className="hl-heading">
        <span className="eyebrow">Estadísticas reales · clubes</span>
        <h1>Mayor o Menor</h1>
        <p>Compara temporadas reales. Acierta si el futbolista de la derecha marcó más o menos goles que el de la izquierda y construye tu racha.</p>
      </div>
      <HigherLowerGame />
    </main>
  );
}
