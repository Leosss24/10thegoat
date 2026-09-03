import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import GameCard from "@/components/GameCard";
import ArenaGameMenu from "@/components/ArenaGameMenu";
import HigherLowerGame from "@/components/games/HigherLowerGame";
import PlayerWordleGame from "@/components/games/PlayerWordleGame";
import GuessTheBadgeGame from "@/components/games/GuessTheBadgeGame";
import CareerModeGame from "@/components/games/CareerModeGame";
import UserDashboard from "@/components/UserDashboard";
import { dictionaries, isLocale, localizedPath, locales, type Dictionary, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string; slug?: string[] }> };
const routePaths = ["", "/usuario", "/juegos", "/juegos/mayor-o-menor", "/juegos/adivina-jugador", "/juegos/adivina-escudo", "/juegos/football-grid", "/juegos/carrera", "/juegos/mi-once", "/beta", "/privacidad", "/cookies", "/aviso-legal"];
export function generateStaticParams() { return locales.flatMap((locale) => routePaths.map((path) => ({ locale, slug: path ? path.slice(1).split("/") : [] }))); }

function pathFor(slug?: string[]) { return slug?.length ? `/${slug.join("/")}` : ""; }
function alternates(locale: Locale, path: string) {
  return { canonical: localizedPath(locale, path), languages: { "es-ES": localizedPath("es", path), "en": localizedPath("en", path), "fr-FR": localizedPath("fr", path), "x-default": localizedPath("es", path) } };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const d = dictionaries[raw]; const path = pathFor(slug);
  const pages: Record<string, { title?: string; description?: string; noindex?: boolean }> = {
    "": { description: d.meta.description }, "/usuario": { title: "Usuario", noindex: true }, "/juegos": { title: d.catalog.title },
    "/juegos/mayor-o-menor": { title: d.games.higherLower.title, description: d.games.higherLower.meta },
    "/juegos/adivina-jugador": { title: d.games.wordle.title, description: d.games.wordle.meta },
    "/juegos/adivina-escudo": { title: d.games.badge.title, description: d.games.badge.meta },
    "/juegos/football-grid": { title: d.games.grid.title, noindex: true }, "/juegos/carrera": { title: d.games.career.title, description: d.games.career.description }, "/juegos/mi-once": { title: d.games.eleven.title, noindex: true },
    "/beta": { title: "Beta", description: d.beta.intro }, "/privacidad": { title: d.legal.privacy.title }, "/cookies": { title: d.legal.cookies.title }, "/aviso-legal": { title: d.legal.notice.title },
  };
  const page = pages[path]; if (!page) return {};
  return { ...page, alternates: alternates(raw, path), openGraph: { url: localizedPath(raw, path), title: page.title, description: page.description }, robots: page.noindex ? { index: false, follow: true } : undefined };
}

function gameCards(d: Dictionary) { return [
  { slug: "adivina-jugador", ...d.games.wordle, status: d.status.available },
  { slug: "carrera", ...d.games.career, status: d.status.beta },
  { slug: "mayor-o-menor", ...d.games.higherLower, status: d.status.available },
  { slug: "football-grid", ...d.games.grid, status: d.status.soon },
  { slug: "adivina-escudo", ...d.games.badge, status: d.status.available },
  { slug: "mi-once", ...d.games.eleven, status: d.status.soon },
]; }

export default async function LocalizedPage({ params }: Props) {
  const { locale: raw, slug } = await params; if (!isLocale(raw)) notFound();
  const locale = raw as Locale; const d = dictionaries[locale]; const path = pathFor(slug); const games = gameCards(d);
  if (path === "/juegos/jugador-misterioso") redirect(localizedPath(locale, "/juegos/adivina-jugador"));
  if (path === "") return <main><section className="hero hero--interactive"><div className="hero-content"><div className="hero-brand-lockup"><img className="hero-shield" src="/brand/10thegoat-shield-raster.png" alt=""/><img className="hero-wordmark" src="/brand/10thegoat-wordmark.svg" alt={d.home.alt}/><img className="hero-shield hero-shield--mirror" src="/brand/10thegoat-shield-raster.png" alt=""/></div><ArenaGameMenu games={games} locale={locale} label={d.home.intro}/></div></section></main>;
  if (path === "/usuario") return <UserDashboard locale={locale}/>;
  if (path === "/juegos") return <main className="section container"><h1>{d.catalog.title}</h1><div className="game-catalog-grid">{games.map((game) => <GameCard key={game.slug} game={game} locale={locale}/>)}</div></main>;
  if (path === "/juegos/mayor-o-menor") return <main className="game-shell game-room container hl-page"><div className="game-room-heading hl-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">{d.games.higherLower.eyebrow}</span><h1>{d.games.higherLower.title}</h1><p>{d.games.higherLower.intro}</p></div></div><HigherLowerGame /></main>;
  if (path === "/juegos/adivina-jugador") return <main className="game-shell game-room container wordle-page"><div className="game-room-heading wordle-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">{d.games.wordle.eyebrow}</span><h1>{d.games.wordle.title}</h1><p>{d.games.wordle.intro}</p></div></div><PlayerWordleGame /></main>;
  if (path === "/juegos/adivina-escudo") return <main className="game-shell game-room container badge-page"><div className="game-room-heading badge-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">{d.games.badge.eyebrow}</span><h1>{d.games.badge.title}</h1><p>{d.games.badge.intro}</p></div></div><GuessTheBadgeGame /></main>;
  if (path === "/juegos/carrera") return <main className="game-shell game-room container career-page"><div className="game-room-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><h1>{d.games.career.title}</h1><p>{d.games.career.description}</p></div></div><CareerModeGame /></main>;
  const placeholder = path === "/juegos/football-grid" ? d.games.grid.title : path === "/juegos/carrera" ? d.games.career.title : path === "/juegos/mi-once" ? d.games.eleven.title : null;
  if (placeholder) return <main className="game-shell container"><h1>{placeholder}</h1><p>{d.games.placeholder.body}</p><div className="placeholder">{d.games.placeholder.label}</div></main>;
  if (path === "/beta") return <main className="info-page container"><span className="eyebrow">v0.12.0-beta.1</span><h1>{d.beta.title}</h1><p className="lead">{d.beta.intro}</p><div className="info-grid"><section className="info-card"><h2>{d.beta.playable}</h2><p>{d.beta.playableText}</p></section><section className="info-card"><h2>{d.beta.development}</h2><p>{d.beta.developmentText}</p></section><section className="info-card"><h2>{d.beta.scores}</h2><p>{d.beta.scoresText}</p></section><section className="info-card"><h2>{d.beta.bug}</h2><p>{d.beta.bugText}</p><a className="btn btn-primary compact" href="https://github.com/Leosss24/10thegoat/issues/new" target="_blank" rel="noreferrer">{d.beta.report}</a></section></div><Link className="text-link" href={localizedPath(locale, "/juegos")}>{d.beta.back}</Link></main>;
  const legal = path === "/privacidad" ? d.legal.privacy : path === "/cookies" ? d.legal.cookies : path === "/aviso-legal" ? d.legal.notice : null;
  if (legal) return <main className="info-page container"><span className="eyebrow">{d.legal.eyebrow}</span><h1>{legal.title}</h1>{"lead" in legal && <p className="lead">{legal.lead}</p>}<div className="legal-copy">{legal.sections.map(([title, body]) => <section key={title || body}>{title && <h2>{title}</h2>}<p>{body}</p></section>)}</div></main>;
  notFound();
}
