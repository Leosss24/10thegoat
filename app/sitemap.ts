import type { MetadataRoute } from "next";
import { locales, localizedPath } from "@/lib/i18n";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://10thegoat.com";
  const paths = ["", "/juegos", "/juegos/mayor-o-menor", "/juegos/adivina-jugador", "/juegos/adivina-escudo", "/juegos/carrera", "/beta", "/privacidad", "/cookies", "/aviso-legal"];
  return locales.flatMap((locale) => paths.map((path) => ({ url: `${base}${localizedPath(locale, path)}`, changeFrequency: path.startsWith("/juegos/") ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : path.startsWith("/juegos/") ? .9 : .6, alternates: { languages: { es: `${base}${localizedPath("es", path)}`, en: `${base}${localizedPath("en", path)}`, fr: `${base}${localizedPath("fr", path)}` } } })));
}
