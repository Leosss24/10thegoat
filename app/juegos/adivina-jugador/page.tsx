import type { Metadata } from "next";
import PlayerWordleGame from "../../../components/games/PlayerWordleGame";

export const metadata: Metadata = { title: "Adivina el jugador", description: "Wordle futbolero: descubre el nombre del jugador en seis intentos." };

export default function Page() {
  return (
    <main className="game-shell container wordle-page">
      <div className="wordle-heading">
        <span className="eyebrow">Wordle futbolero</span>
        <h1>Adivina el jugador</h1>
        <p>Seis intentos. Una letra verde está en su sitio; una amarilla está en el nombre, pero en otra posición. Las tildes no cuentan.</p>
      </div>
      <PlayerWordleGame />
    </main>
  );
}
