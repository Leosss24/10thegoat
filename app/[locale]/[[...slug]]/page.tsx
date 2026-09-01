import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import GameCard from "@/components/GameCard";
import HigherLowerGame from "@/components/games/HigherLowerGame";
import PlayerWordleGame from "@/components/games/PlayerWordleGame";
import GuessTheBadgeGame from "@/components/games/GuessTheBadgeGame";
import { dictionaries, isLocale, localizedPath, locales, type Dictionary, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string; slug?: string[] }> };
const routePaths = ["", "/juegos", "/juegos/mayor-o-menor", "/juegos/adivina-jugador", "/juegos/adivina-escudo", "/juegos/football-grid", "/juegos/carrera", "/juegos/mi-once", "/beta", "/privacidad", "/cookies", "/aviso-legal"];
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
    "": { description: d.meta.description }, "/juegos": { title: d.catalog.title },
    "/juegos/mayor-o-menor": { title: d.games.higherLower.title, description: d.games.higherLower.meta },
    "/juegos/adivina-jugador": { title: d.games.wordle.title, description: d.games.wordle.meta },
    "/juegos/adivina-escudo": { title: d.games.badge.title, description: d.games.badge.meta },
    "/juegos/football-grid": { title: d.games.grid.title, noindex: true }, "/juegos/carrera": { title: d.games.career.title, noindex: true }, "/juegos/mi-once": { title: d.games.eleven.title, noindex: true },
    "/beta": { title: "Beta", description: d.beta.intro }, "/privacidad": { title: d.legal.privacy.title }, "/cookies": { title: d.legal.cookies.title }, "/aviso-legal": { title: d.legal.notice.title },
  };
  const page = pages[path]; if (!page) return {};
  return { ...page, alternates: alternates(raw, path), openGraph: { url: localizedPath(raw, path), title: page.title, description: page.description }, robots: page.noindex ? { index: false, follow: true } : undefined };
}

function gameCards(d: Dictionary) { return [
  { slug: "mayor-o-menor", icon: "📈", ...d.games.higherLower, status: d.status.available },
  { slug: "adivina-jugador", icon: "🔤", ...d.games.wordle, status: d.status.available },
  { slug: "football-grid", icon: "🧠", ...d.games.grid, status: d.status.soon },
  { slug: "carrera", icon: "🏆", ...d.games.career, status: d.status.soon },
  { slug: "mi-once", icon: "🧩", ...d.games.eleven, status: d.status.soon },
  { slug: "adivina-escudo", icon: "🛡️", ...d.games.badge, status: d.status.available },
]; }

export default async function LocalizedPage({ params }: Props) {
  const { locale: raw, slug } = await params; if (!isLocale(raw)) notFound();
  const locale = raw as Locale; const d = dictionaries[locale]; const path = pathFor(slug); const games = gameCards(d);
  if (path === "/juegos/jugador-misterioso") redirect(localizedPath(locale, "/juegos/adivina-jugador"));
  if (path === "") return <main><section className="hero"><div className="hero-arena" aria-hidden="true"/><div className="hero-content container"><img className="hero-wordmark" src="/brand/10thegoat-wordmark.svg" alt={d.home.alt}/><div className="eyebrow">{d.home.eyebrow}</div><h1>{d.home.title}</h1><p>{d.home.intro}</p><div className="actions"><Link className="btn btn-primary" href={localizedPath(locale, "/juegos")}>{d.home.play}</Link><Link className="btn" href={localizedPath(locale, "/beta")}>{d.home.beta}</Link></div></div></section><section className="section container"><div className="section-heading-row"><div><span className="eyebrow">{d.home.version}</span><h2>{d.home.games}</h2></div><Link className="text-link" href={localizedPath(locale, "/juegos")}>{d.home.all}</Link></div><div className="grid">{games.map((game) => <GameCard key={game.slug} game={game} locale={locale}/>)}</div></section></main>;
  if (path === "/juegos") return <main className="section container"><h1>{d.catalog.title}</h1><div className="grid">{games.map((game) => <GameCard key={game.slug} game={game} locale={locale}/>)}</div></main>;
  if (path === "/juegos/mayor-o-menor") return <main className="game-shell container hl-page"><div className="hl-heading"><span className="eyebrow">{d.games.higherLower.eyebrow}</span><h1>{d.games.higherLower.title}</h1><p>{d.games.higherLower.intro}</p></div><HigherLowerGame /></main>;
  if (path === "/juegos/adivina-jugador") return <main className="game-shell container wordle-page"><div className="wordle-heading"><span className="eyebrow">{d.games.wordle.eyebrow}</span><h1>{d.games.wordle.title}</h1><p>{d.games.wordle.intro}</p></div><PlayerWordleGame /></main>;
  if (path === "/juegos/adivina-escudo") return <main className="game-shell container badge-page"><div className="badge-heading"><span className="eyebrow">{d.games.badge.eyebrow}</span><h1>{d.games.badge.title}</h1><p>{d.games.badge.intro}</p></div><GuessTheBadgeGame /></main>;
  const placeholder = path === "/juegos/football-grid" ? d.games.grid.title : path === "/juegos/carrera" ? d.games.career.title : path === "/juegos/mi-once" ? d.games.eleven.title : null;
  if (placeholder) return <main className="game-shell container"><h1>{placeholder}</h1><p>{d.games.placeholder.body}</p><div className="placeholder">{d.games.placeholder.label}</div></main>;
  if (path === "/beta") return <main className="info-page container"><span className="eyebrow">v0.12.0-beta.1</span><h1>{d.beta.title}</h1><p className="lead">{d.beta.intro}</p><div className="info-grid"><section className="info-card"><h2>{d.beta.playable}</h2><p>{d.beta.playableText}</p></section><section className="info-card"><h2>{d.beta.development}</h2><p>{d.beta.developmentText}</p></section><section className="info-card"><h2>{d.beta.scores}</h2><p>{d.beta.scoresText}</p></section><section className="info-card"><h2>{d.beta.bug}</h2><p>{d.beta.bugText}</p><a className="btn btn-primary compact" href="https://github.com/Leosss24/10thegoat/issues/new" target="_blank" rel="noreferrer">{d.beta.report}</a></section></div><Link className="text-link" href={localizedPath(locale, "/juegos")}>{d.beta.back}</Link></main>;
  const legal = path === "/privacidad" ? d.legal.privacy : path === "/cookies" ? d.legal.cookies : path === "/aviso-legal" ? d.legal.notice : null;
  if (legal) return <main className="info-page container"><span className="eyebrow">{d.legal.eyebrow}</span><h1>{legal.title}</h1>{"lead" in legal && <p className="lead">{legal.lead}</p>}<div className="legal-copy">{legal.sections.map(([title, body]) => <section key={title || body}>{title && <h2>{title}</h2>}<p>{body}</p></section>)}</div></main>;
  notFound();
}
