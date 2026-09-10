"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localizedPath, type Locale } from "@/lib/i18n";

const NAME = "10tg-cookie-notice";
const copy = {
  es: { title: "Cookies y almacenamiento local", body: "Usamos cookies tecnicas para recordar el idioma y almacenamiento del navegador para conservar tus partidas. La publicidad sigue desactivada hasta configurar AdSense y su panel de consentimiento.", more: "Ver la politica de cookies", accept: "Entendido" },
  en: { title: "Cookies and local storage", body: "We use technical cookies to remember your language and browser storage to keep your games. Advertising remains disabled until you configure AdSense and its consent panel.", more: "Read the cookie policy", accept: "Got it" },
  fr: { title: "Cookies et stockage local", body: "Nous utilisons des cookies techniques pour memoriser votre langue et le stockage du navigateur pour conserver vos parties. La publicite reste desactivee jusqu a la configuration d AdSense et de son panneau de consentement.", more: "Voir la politique de cookies", accept: "J ai compris" },
} as const;

export default function CookieNotice({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const t = copy[locale];
  useEffect(() => { setVisible(!document.cookie.split("; ").some((value) => value.startsWith(NAME + "="))); }, []);
  function acknowledge() { document.cookie = NAME + "=acknowledged;path=/;max-age=31536000;samesite=lax"; setVisible(false); }
  if (!visible) return null;
  return <section className="cookie-notice" role="region" aria-label={t.title}><div className="cookie-notice__copy"><strong>{t.title}</strong><p>{t.body}</p></div><div className="cookie-notice__actions"><Link href={localizedPath(locale, "/cookies")}>{t.more}</Link><button type="button" className="btn btn-primary compact" onClick={acknowledge}>{t.accept}</button></div></section>;
}
