import type { Metadata } from "next";
import type { Locale } from "../i18n";

export function challengeMetadata(locale: Locale, path: string, title: string, description: string, available = true): Metadata {
  const url = `/${locale}${path}`;
  const images = [{ url: "/brand/10thegoat-og-1200x630.png", width: 1200, height: 630, alt: "10theGOAT" }];
  return {
    title, description,
    alternates: { canonical: url, languages: { "es-ES": `/es${path}`, en: `/en${path}`, "fr-FR": `/fr${path}`, "x-default": `/es${path}` } },
    openGraph: { type: "website", siteName: "10theGOAT", title, description, url, images },
    twitter: { card: "summary_large_image", title, description, images: images.map(image => image.url) },
    robots: available ? undefined : { index: false, follow: true },
  };
}
