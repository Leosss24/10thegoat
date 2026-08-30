import GameCard from "@/components/GameCard";
import { games } from "@/data/games";

export default function GamesPage() {
  return <main className="section container"><h2>Todos los juegos</h2><div className="grid">{games.map((game) => <GameCard key={game.slug} game={game} />)}</div></main>;
}
