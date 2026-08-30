import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "10 The GOAT | Juegos de fútbol",
  description: "Minijuegos, retos diarios y simuladores para enfermos del fútbol.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <div className="container nav">
            <Link className="brand" href="/"><strong>10</strong> The GOAT</Link>
            <nav className="nav-links">
              <Link href="/juegos">Juegos</Link>
              <Link href="/juegos/carrera">Modo Carrera</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="footer"><div className="container">10 The GOAT · 10thegoat.com</div></footer>
      </body>
    </html>
  );
}
