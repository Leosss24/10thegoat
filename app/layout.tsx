import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://10thegoat.com"),
  title: {
    default: "10theGOAT | Juegos de fútbol online",
    template: "%s | 10theGOAT",
  },
  description: "Juegos de fútbol online para poner a prueba tus conocimientos: Adivina el jugador, Mayor o Menor, Adivina el Escudo y más.",
  applicationName: "10theGOAT",
  keywords: ["juegos de fútbol", "fútbol online", "quiz fútbol", "wordle fútbol", "10theGOAT"],
  authors: [{ name: "10theGOAT" }],
  creator: "10theGOAT",
  publisher: "10theGOAT",
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/",
    siteName: "10theGOAT",
    title: "10theGOAT | Juegos de fútbol online",
    description: "Pon a prueba cuánto sabes de fútbol con retos y minijuegos gratuitos.",
    images: [{ url: "/brand/10thegoat-og-1200x630.png", width: 1200, height: 630, alt: "10theGOAT · Juegos de fútbol online" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "10theGOAT | Juegos de fútbol online",
    description: "Pon a prueba cuánto sabes de fútbol con retos y minijuegos gratuitos.",
    images: ["/brand/10thegoat-og-1200x630.png"],
  },
  icons: {
    icon: [
      { url: "/brand/10thegoat-shield-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/10thegoat-shield-64x64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [{ url: "/brand/10thegoat-shield-256x256.png", sizes: "256x256", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <div className="container nav">
            <Link className="brand" href="/" aria-label="10theGOAT · Inicio">
              <img className="brand-logo" src="/brand/10thegoat-shield-64x64.png" alt="" />
              <span><strong>10</strong>the<strong>GOAT</strong></span>
              <em className="beta-pill">BETA</em>
            </Link>
            <nav className="nav-links" aria-label="Navegación principal">
              <Link href="/juegos">Juegos</Link>
              <Link href="/beta">Beta</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="container footer-layout">
            <div className="footer-brand"><img src="/brand/10thegoat-shield-48x48.png" alt="" /><span><strong>10</strong>the<strong>GOAT</strong> · Beta</span></div>
            <nav className="footer-links" aria-label="Información legal">
              <Link href="/privacidad">Privacidad</Link>
              <Link href="/cookies">Cookies</Link>
              <Link href="/aviso-legal">Aviso legal</Link>
              <Link href="/beta">Feedback</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
