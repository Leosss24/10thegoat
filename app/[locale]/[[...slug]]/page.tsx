import AdSlot from "@/components/ads/AdSlot";
import PrivacyPreferences from "@/components/ads/PrivacyPreferences";
import { adsCopy } from "@/lib/ads/copy";
import { getAdsConfig } from "@/lib/ads/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import GameCard from "@/components/GameCard";
import HomeGameGrid from "@/components/HomeGameGrid";
import HigherLowerGame from "@/components/games/HigherLowerGame";
import PlayerWordleGame from "@/components/games/PlayerWordleGame";
import GuessTheBadgeGame from "@/components/games/GuessTheBadgeGame";
import CareerModeGame from "@/components/games/CareerModeGame";
import UserDashboard from "@/components/UserDashboard";
import { challengeCatalog } from "@/lib/trivia/challenge-catalog.server";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import FootballGridGame from "@/components/games/FootballGridGame";
import { gridCopy } from "@/lib/football-grid/copy";
import TriviaGame from "@/components/games/TriviaGame";
import { triviaCopy } from "@/lib/trivia/copy";
import OddOneOutGame from "@/components/games/OddOneOutGame";
import { oddOneOutCopy } from "@/lib/odd-one-out/copy";
import ConnectionsGame from "@/components/games/ConnectionsGame";
import { connectionsCopy } from "@/lib/connections/data";
import TimelineGame from "@/components/games/TimelineGame";
import { timelineCopy } from "@/lib/timeline/data";
import { dictionaries, isLocale, localizedPath, locales, type Dictionary, type Locale } from "@/lib/i18n";
import GameGuide from "@/components/GameGuide";
import DidYouKnow from "@/components/DidYouKnow";
import FirstWorldCupArticle from "@/components/articles/FirstWorldCupArticle";
import ArticlesIndex from "@/components/articles/ArticlesIndex";
import ArticleTags from "@/components/articles/ArticleTags";
import FootballArticle from "@/components/articles/FootballArticle";
import { articles, getArticle } from "@/data/articles";
import { getArticleContent } from "@/data/article-content";
import FeaturedArticles from "@/components/articles/FeaturedArticles";

type Props = { params: Promise<{ locale: string; slug?: string[] }> };
const routePaths = ["", "/usuario", "/juegos", "/juegos/mayor-o-menor", "/juegos/adivina-jugador", "/juegos/adivina-escudo", "/juegos/football-grid", "/juegos/carrera", "/juegos/mi-once", "/juegos/trivia", "/juegos/el-intruso", "/juegos/conexiones", "/juegos/ordena-historia", "/proyecto", "/articulos", ...articles.map((article) => `/articulos/${article.slug}`), "/privacidad", "/cookies", "/aviso-legal"];
export function generateStaticParams() { return locales.flatMap((locale) => routePaths.map((path) => ({ locale, slug: path ? path.slice(1).split("/") : [] }))); }

function pathFor(slug?: string[]) { return slug?.length ? `/${slug.join("/")}` : ""; }
function alternates(locale: Locale, path: string) {
  return { canonical: localizedPath(locale, path), languages: { "es-ES": localizedPath("es", path), "en": localizedPath("en", path), "fr-FR": localizedPath("fr", path), "x-default": localizedPath("es", path) } };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const d = dictionaries[raw]; const path = pathFor(slug);
  if (raw === "es" && path.startsWith("/articulos/")) {
    const article = getArticle(path.slice("/articulos/".length));
    if (article) return { title: article.title, description: article.excerpt, alternates: { canonical: localizedPath("es", path) }, openGraph: { url: localizedPath("es", path), title: article.title, description: article.excerpt, images: [{ url: article.image.src, alt: article.image.alt }] } };
  }
  const pages: Record<string, { title?: string; description?: string; noindex?: boolean }> = {
    "/juegos/trivia": { title: "TRIVIA", description: triviaCopy[raw].description },
    "/juegos/el-intruso": { title: oddOneOutCopy[raw].title, description: oddOneOutCopy[raw].description },
    "/juegos/conexiones": { title: connectionsCopy[raw].title, description: connectionsCopy[raw].description },
    "/juegos/ordena-historia": { title: timelineCopy[raw].title, description: timelineCopy[raw].description },
    "": { description: d.meta.description }, "/usuario": { title: "Usuario", noindex: true }, "/juegos": { title: d.catalog.title },
    "/juegos/mayor-o-menor": { title: d.games.higherLower.title, description: d.games.higherLower.meta },
    "/juegos/adivina-jugador": { title: d.games.wordle.title, description: d.games.wordle.meta },
    "/juegos/adivina-escudo": { title: d.games.badge.title, description: d.games.badge.meta },
    "/juegos/football-grid": { title: d.games.grid.title, description: gridCopy[raw].description }, "/juegos/carrera": { title: d.games.career.title, description: d.games.career.description }, "/juegos/mi-once": { title: d.games.eleven.title, noindex: true },
    "/proyecto": { title: d.beta.title, description: d.beta.intro }, "/privacidad": { title: d.legal.privacy.title }, "/cookies": { title: d.legal.cookies.title }, "/aviso-legal": { title: d.legal.notice.title },
    "/articulos/primer-mundial-1930": { title: "Uruguay 1930: así nació la Copa Mundial", description: "La historia, los viajes y las curiosidades del primer Mundial de fútbol." },
    "/articulos": { title: "Artículos de fútbol", description: "Historia, táctica, reglas y curiosidades del fútbol explicadas con fuentes." },
  };
  const page = pages[path]; if (!page) return {};
  return { ...page, alternates: alternates(raw, path), openGraph: { url: localizedPath(raw, path), title: page.title, description: page.description }, robots: page.noindex ? { index: false, follow: true } : undefined };
}

function gameCards(d: Dictionary, locale: Locale) { return [
  { slug: "adivina-jugador", ...d.games.wordle, status: d.status.available },
  { slug: "carrera", ...d.games.career, status: d.status.beta },
  { slug: "mayor-o-menor", ...d.games.higherLower, status: d.status.available },
  { slug: "football-grid", ...d.games.grid, description: gridCopy[locale].description, status: d.status.available },
  { slug: "adivina-escudo", ...d.games.badge, status: d.status.available },
  { slug: "trivia", title: "TRIVIA", description: triviaCopy[locale].description, status: d.status.available },
  { slug: "el-intruso", title: oddOneOutCopy[locale].title, description: oddOneOutCopy[locale].description, status: d.status.available },
  { slug: "conexiones", title: connectionsCopy[locale].title, description: connectionsCopy[locale].description, status: d.status.available },
  { slug: "ordena-historia", title: timelineCopy[locale].title, description: timelineCopy[locale].description, status: d.status.available },
]; }

export default async function LocalizedPage({ params }: Props) {
  const { locale: raw, slug } = await params; if (!isLocale(raw)) notFound();
  const locale = raw as Locale; const d = dictionaries[locale]; const path = pathFor(slug); const games = gameCards(d, locale);
  if (path === "/juegos/football-grid") return <main className="game-shell game-room container fg-page"><div className="game-room-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">10theGOAT</span><h1>FOOTBALL GRID</h1><p>{gridCopy[locale].description}</p></div></div><AdSlot placement="game-top" /><FootballGridGame /><AdSlot placement="game-bottom" /></main>;
  if (path === "/juegos/trivia") return <main className="game-shell game-room container trivia-page"><div className="game-room-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">10theGOAT</span><h1>TRIVIA</h1><p>{triviaCopy[locale].description}</p></div></div><AdSlot placement="game-top" /><TriviaGame /><AdSlot placement="game-bottom" /></main>;
  if (path === "/juegos/el-intruso") return <main className="game-shell game-room container odd-page"><div className="game-room-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">10theGOAT</span><h1>{oddOneOutCopy[locale].title}</h1><p>{oddOneOutCopy[locale].description}</p></div></div><AdSlot placement="game-top" /><OddOneOutGame /><AdSlot placement="game-bottom" /></main>;
  if (path === "/juegos/conexiones") return <main className="game-shell game-room container connections-page"><div className="game-room-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">10theGOAT</span><h1>{connectionsCopy[locale].title}</h1><p>{connectionsCopy[locale].description}</p></div></div><AdSlot placement="game-top" /><ConnectionsGame /><AdSlot placement="game-bottom" /></main>;
  if (path === "/juegos/ordena-historia") return <main className="game-shell game-room container timeline-page"><div className="game-room-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">10theGOAT</span><h1>{timelineCopy[locale].title}</h1><p>{timelineCopy[locale].description}</p></div></div><AdSlot placement="game-top" /><TimelineGame /><AdSlot placement="game-bottom" /></main>;
  if (path === "/juegos/jugador-misterioso") redirect(localizedPath(locale, "/juegos/adivina-jugador"));
  if (path === "") return <main className="home-page"><AdSlot placement="home-top" /><section className="hero hero--locker"><div className="hero-content"><div className="hero-brand-lockup"><img className="hero-shield" src="/brand/10thegoat-shield-raster.png" alt=""/><img className="hero-wordmark" src="/brand/10thegoat-wordmark.svg" alt={d.home.alt}/><img className="hero-shield hero-shield--mirror" src="/brand/10thegoat-shield-raster.png" alt=""/></div><h1>{d.home.title}</h1><p>{d.home.intro}</p><Link className="btn btn-primary home-cta" href="#juegos">{d.home.play} <span aria-hidden="true">↓</span></Link></div></section><HomeGameGrid games={games} locale={locale} title={d.home.games} allGames={d.home.all}/>{locale === "es" && <div className="container home-editorial"><DidYouKnow/><FeaturedArticles/></div>}<AdSlot placement="home-bottom" /></main>;
  if (path === "/usuario") return <UserDashboard locale={locale} challenges={challengeCatalog().map(({id,available,opensOn})=>({id,available,opensOn}))}/>;
  if (path === "/articulos/primer-mundial-1930") { if(locale !== "es") notFound(); return <><div className="article-route-tags container"><ArticleTags tags={["historia","mundiales","estadios","curiosidades"]}/></div><FirstWorldCupArticle/></>; }
  if (path.startsWith("/articulos/")) {
    if (locale !== "es") notFound();
    const articleSlug = path.slice("/articulos/".length);
    const summary = getArticle(articleSlug);
    const content = getArticleContent(articleSlug);
    if (!summary || !content) notFound();
    return <FootballArticle summary={summary} content={content}/>;
  }
  if (path === "/articulos") { if(locale !== "es") notFound(); return <ArticlesIndex/>; }
  if (path === "/juegos") return <main className="section container"><h1>{d.catalog.title}</h1><AdSlot placement="catalog-top" /><div className="game-catalog-grid">{games.map((game) => <GameCard key={game.slug} game={game} locale={locale}/>)}</div><AdSlot placement="catalog-bottom" /></main>;
  if (path === "/juegos/mayor-o-menor") return <main className="game-shell game-room container hl-page"><div className="game-room-heading hl-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">{d.games.higherLower.eyebrow}</span><h1>{d.games.higherLower.title}</h1><p>{d.games.higherLower.intro}</p></div></div><AdSlot placement="game-top" /><HigherLowerGame /><AdSlot placement="game-bottom" /><GameGuide locale={locale} game="higherLower" /></main>;
  if (path === "/juegos/adivina-jugador") return <main className="game-shell game-room container wordle-page"><div className="game-room-heading wordle-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">{d.games.wordle.eyebrow}</span><h1>{d.games.wordle.title}</h1><p>{d.games.wordle.intro}</p></div></div><AdSlot placement="game-top" /><PlayerWordleGame /><AdSlot placement="game-bottom" /><GameGuide locale={locale} game="wordle" /></main>;
  if (path === "/juegos/adivina-escudo") return <main className="game-shell game-room container badge-page"><div className="game-room-heading badge-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><span className="eyebrow">{d.games.badge.eyebrow}</span><h1>{d.games.badge.title}</h1><p>{d.games.badge.intro}</p></div></div><AdSlot placement="game-top" /><GuessTheBadgeGame /><AdSlot placement="game-bottom" /><GameGuide locale={locale} game="badge" /></main>;
  if (path === "/juegos/carrera") return <main className="game-shell game-room container career-page"><div className="game-room-heading"><Link href={`/${locale}`} className="game-room-back">← ARENA</Link><div><h1>{d.games.career.title}</h1><p>{d.games.career.description}</p></div></div><AdSlot placement="game-top" /><CareerModeGame /><AdSlot placement="game-bottom" /></main>;
  const placeholder = path === "/juegos/carrera" ? d.games.career.title : path === "/juegos/mi-once" ? d.games.eleven.title : null;
  if (placeholder) return <main className="game-shell container"><h1>{placeholder}</h1><p>{d.games.placeholder.body}</p><div className="placeholder">{d.games.placeholder.label}</div></main>;
  if (path === "/beta") redirect(localizedPath(locale, "/proyecto"));
  if (path === "/proyecto") return <main className="info-page container"><h1>{d.beta.title}</h1><p className="lead">{d.beta.intro}</p><div className="info-grid"><section className="info-card"><h2>{d.beta.playable}</h2><p>{d.beta.playableText}</p><Link className="text-link" href={localizedPath(locale, "/juegos")}>{d.beta.gamesLink}</Link></section><section className="info-card"><h2>{d.beta.scores}</h2><p>{d.beta.scoresText}</p><GoogleSignInButton locale={locale} /></section><section className="info-card"><h2>{d.beta.bug}</h2><p>{d.beta.bugText}</p><a className="btn btn-primary compact" href="mailto:contact@10thegoat.com">{d.beta.report}</a></section></div><Link className="text-link" href={localizedPath(locale, "/juegos")}>{d.beta.back}</Link></main>;
  const legal = path === "/privacidad" ? d.legal.privacy : path === "/cookies" ? d.legal.cookies : path === "/aviso-legal" ? d.legal.notice : null;
  if (legal) return <main className="info-page container"><span className="eyebrow">{d.legal.eyebrow}</span><h1>{legal.title}</h1>{"lead" in legal && typeof legal.lead === "string" && <p className="lead">{legal.lead}</p>}<div className="legal-copy">{legal.sections.map(([title, body]) => <section key={title || body}>{title && <h2>{title}</h2>}<p>{body}</p></section>)}{path === "/aviso-legal" && <section><h2>{locale === "es" ? "Contacto" : "Contact"}</h2><ul className="legal-contacts"><li><span>{locale === "es" ? "Contacto general" : locale === "fr" ? "Contact general" : "General contact"}</span><a href="mailto:contact@10thegoat.com">contact@10thegoat.com</a></li><li><span>Business</span><a href="mailto:business@10thegoat.com">business@10thegoat.com</a></li><li><span>{locale === "es" ? "Publicidad" : locale === "fr" ? "Publicite" : "Advertising"}</span><a href="mailto:advertising@10thegoat.com">advertising@10thegoat.com</a></li><li><span>{locale === "es" ? "Colaboraciones" : locale === "fr" ? "Partenariats" : "Partnerships"}</span><a href="mailto:partnerships@10thegoat.com">partnerships@10thegoat.com</a></li><li><span>{locale === "es" ? "Prensa" : locale === "fr" ? "Presse" : "Press"}</span><a href="mailto:press@10thegoat.com">press@10thegoat.com</a></li></ul></section>}</div>{path !== "/aviso-legal" && <div className="legal-copy"><p><a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">{adsCopy[locale].google}</a></p>{getAdsConfig(process.env).mode !== "live" && <p>{adsCopy[locale].inactive}</p>}<PrivacyPreferences /></div>}</main>;
  notFound();
}
