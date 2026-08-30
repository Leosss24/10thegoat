import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Beta", description: "Estado y feedback de la Beta pública de 10theGOAT." };

export default function BetaPage() {
  return <main className="info-page container">
    <span className="eyebrow">v0.11.0-beta.1</span>
    <h1>10theGOAT está en Beta</h1>
    <p className="lead">La web ya se puede jugar, pero seguimos afinando nombres, escudos, puntuaciones, rendimiento y experiencia móvil.</p>
    <div className="info-grid">
      <section className="info-card"><h2>Jugable ahora</h2><p>Adivina el jugador, Mayor o Menor y Adivina el Escudo.</p></section>
      <section className="info-card"><h2>En desarrollo</h2><p>Football Grid, Modo Carrera, Mi XI, cuentas de usuario y rankings globales.</p></section>
      <section className="info-card"><h2>Puntuaciones</h2><p>Durante esta Beta se guardan en este navegador. Al introducir cuentas, pasarán a estar vinculadas al usuario.</p></section>
      <section className="info-card"><h2>¿Has encontrado un fallo?</h2><p>Cuéntanos qué estabas haciendo, qué navegador usabas y, si puedes, adjunta una captura.</p><a className="btn btn-primary compact" href="https://github.com/Leosss24/10thegoat/issues/new" target="_blank" rel="noreferrer">Reportar en GitHub</a></section>
    </div>
    <Link className="text-link" href="/juegos">← Volver a los juegos</Link>
  </main>;
}
