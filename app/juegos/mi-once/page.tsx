import type { Metadata } from "next";
export const metadata: Metadata = { title: "Mi XI", robots: { index: false, follow: true } };
export default function Page() {
  return (
    <main className="game-shell container">
      <h1>Mi XI</h1>
      <p>La ruta ya está preparada. Este módulo se conectará al núcleo común de datos de 10 The GOAT.</p>
      <div className="placeholder">⚽ Módulo en construcción</div>
    </main>
  );
}
