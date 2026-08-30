import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://10thegoat.com";
  return ["", "/juegos", "/juegos/mayor-o-menor", "/juegos/adivina-jugador", "/juegos/adivina-escudo", "/beta", "/privacidad", "/cookies", "/aviso-legal"].map((path) => ({ url: `${base}${path}`, changeFrequency: path.startsWith("/juegos/") ? "weekly" : "monthly", priority: path === "" ? 1 : path.startsWith("/juegos/") ? .9 : .6 }));
}
