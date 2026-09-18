import type { MetadataRoute } from "next";
import { locales, localizedPath } from "@/lib/i18n";
import { articles } from "@/data/articles";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://10thegoat.com";
  const paths = ["", "/juegos", "/juegos/mayor-o-menor", "/juegos/adivina-jugador", "/juegos/adivina-escudo", "/juegos/carrera", "/juegos/trivia", "/juegos/el-intruso", "/juegos/conexiones", "/juegos/ordena-historia", "/juegos/football-grid", "/proyecto", "/privacidad", "/cookies", "/aviso-legal"];
  const localized = locales.flatMap((locale) => paths.map((path) => ({ url: `${base}${localizedPath(locale, path)}`, changeFrequency: path.startsWith("/juegos/") ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : path.startsWith("/juegos/") ? .9 : .6, alternates: { languages: { es: `${base}${localizedPath("es", path)}`, en: `${base}${localizedPath("en", path)}`, fr: `${base}${localizedPath("fr", path)}` } } })));
  return [...localized, { url: `${base}/es/articulos`, changeFrequency: "weekly" as const, priority: .75 }, ...articles.map((article) => ({ url: `${base}/es/articulos/${article.slug}`, lastModified: article.publishedAt, changeFrequency: "yearly" as const, priority: .7 }))];
}
