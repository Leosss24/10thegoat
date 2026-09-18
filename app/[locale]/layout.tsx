import AdsProvider from "@/components/ads/AdsProvider";
import PrivacyPreferences from "@/components/ads/PrivacyPreferences";
import { getAdsConfig, getVerificationClient } from "@/lib/ads/config";
import "@/components/ads/ads.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { dictionaries, isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CookieNotice from "@/components/CookieNotice";
import AccountScoreStorage from "@/components/AccountScoreStorage";
import BadgeProvider from "@/components/badges/BadgeProvider";
import "@/components/badges/badges.css";
import "../globals.css";
import "../game-art.css";

const bodyFont = localFont({
  src: [
    { path: "../fonts/Barlow-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/Barlow-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/Barlow-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});
const displayFont = localFont({
  src: [
    { path: "../fonts/BarlowCondensed-Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/BarlowCondensed-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = { themeColor: "#080B10", colorScheme: "dark" };
export function generateStaticParams() { return [{ locale: "es" }, { locale: "en" }, { locale: "fr" }]; }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value)) return {};
  const d = dictionaries[value];
  const verificationClient = getVerificationClient(process.env);
  return {
    other: verificationClient ? { "google-adsense-account": verificationClient } : undefined,
    metadataBase: new URL("https://10thegoat.com"), applicationName: "10theGOAT",
    title: { default: `10theGOAT | ${d.meta.title}`, template: "%s | 10theGOAT" }, description: d.meta.description,
    authors: [{ name: "10theGOAT" }], creator: "10theGOAT", publisher: "10theGOAT",
    openGraph: { type: "website", locale: value === "es" ? "es_ES" : value === "en" ? "en_GB" : "fr_FR", siteName: "10theGOAT", title: `10theGOAT | ${d.meta.title}`, description: d.meta.shortDescription, images: [{ url: "/brand/10thegoat-og-1200x630.png", width: 1200, height: 630, alt: d.home.alt }] },
    icons: { icon: [{ url: "/brand/10thegoat-icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/10thegoat-icon-64.png", sizes: "64x64", type: "image/png" }], apple: [{ url: "/brand/10thegoat-icon-180.png", sizes: "180x180", type: "image/png" }] },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value as Locale;
  const d = dictionaries[locale];
  return <html lang={locale} data-scroll-behavior="smooth" className={`${bodyFont.variable} ${displayFont.variable}`}><body><I18nProvider locale={locale} dictionary={d}><AdsProvider config={getAdsConfig(process.env)}>
    <header className="site-header"><div className="container nav">
      <Link className="brand" href={localizedPath(locale)} aria-label={`10theGOAT · ${d.nav.home}`}><img className="brand-logo" src="/brand/10thegoat-shield-raster.png" alt=""/><span><strong>10</strong>the<strong>GOAT</strong></span></Link>
      <nav className="nav-links" aria-label={d.nav.main}><Link href={localizedPath(locale, "/juegos")}>{d.nav.games}</Link>{locale === "es" && <Link href="/es/articulos">Artículos</Link>}<Link href={localizedPath(locale,"/usuario")}>{locale==="es"?"Mi zona":locale==="fr"?"Mon espace":"My account"}</Link><LanguageSwitcher /></nav>
    </div></header>{children}<AccountScoreStorage /><BadgeProvider /><CookieNotice locale={locale} />
    <footer className="footer"><div className="container footer-layout"><div className="footer-brand"><img src="/brand/10thegoat-shield-raster.png" alt=""/><span><strong>10</strong>the<strong>GOAT</strong></span></div><nav className="footer-links" aria-label={d.nav.legal}><Link href={localizedPath(locale, "/privacidad")}>{d.nav.privacy}</Link><Link href={localizedPath(locale, "/cookies")}>{d.nav.cookies}</Link><Link href={localizedPath(locale, "/aviso-legal")}>{d.nav.notice}</Link><Link href={localizedPath(locale, "/proyecto")}>{d.nav.feedback}</Link><PrivacyPreferences /></nav></div></footer>
  </AdsProvider></I18nProvider></body></html>;
}
