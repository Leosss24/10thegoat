import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dictionaries, isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import "../globals.css";

export const viewport: Viewport = { themeColor: "#080B10", colorScheme: "dark" };
export function generateStaticParams() { return [{ locale: "es" }, { locale: "en" }, { locale: "fr" }]; }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value)) return {};
  const d = dictionaries[value];
  return {
    metadataBase: new URL("https://10thegoat.com"), applicationName: "10theGOAT",
    title: { default: `10theGOAT | ${d.meta.title}`, template: "%s | 10theGOAT" }, description: d.meta.description,
    authors: [{ name: "10theGOAT" }], creator: "10theGOAT", publisher: "10theGOAT",
    openGraph: { type: "website", locale: value === "es" ? "es_ES" : value === "en" ? "en_GB" : "fr_FR", siteName: "10theGOAT", title: `10theGOAT | ${d.meta.title}`, description: d.meta.shortDescription, images: [{ url: "/brand/10thegoat-og-1200x630.png", width: 1200, height: 630, alt: d.home.alt }] },
    twitter: { card: "summary_large_image", title: `10theGOAT | ${d.meta.title}`, description: d.meta.shortDescription, images: ["/brand/10thegoat-og-1200x630.png"] },
    icons: { icon: [{ url: "/brand/10thegoat-icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/10thegoat-icon-64.png", sizes: "64x64", type: "image/png" }], apple: [{ url: "/brand/10thegoat-icon-180.png", sizes: "180x180", type: "image/png" }] },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value as Locale;
  const d = dictionaries[locale];
  return <html lang={locale}><body><I18nProvider locale={locale} dictionary={d}>
    <header className="site-header"><div className="container nav">
      <Link className="brand" href={localizedPath(locale)} aria-label={`10theGOAT · ${d.nav.home}`}><img className="brand-logo" src="/brand/10thegoat-shield-raster.png" alt=""/><span><strong>10</strong>the<strong>GOAT</strong></span></Link>
      <nav className="nav-links" aria-label={d.nav.main}><Link href={localizedPath(locale, "/juegos")}>{d.nav.games}</Link><LanguageSwitcher /></nav>
    </div></header>{children}
    <footer className="footer"><div className="container footer-layout"><div className="footer-brand"><img src="/brand/10thegoat-shield-raster.png" alt=""/><span><strong>10</strong>the<strong>GOAT</strong></span></div><nav className="footer-links" aria-label={d.nav.legal}><Link href={localizedPath(locale, "/privacidad")}>{d.nav.privacy}</Link><Link href={localizedPath(locale, "/cookies")}>{d.nav.cookies}</Link><Link href={localizedPath(locale, "/aviso-legal")}>{d.nav.notice}</Link><Link href={localizedPath(locale, "/beta")}>{d.nav.feedback}</Link></nav></div></footer>
  </I18nProvider></body></html>;
}
