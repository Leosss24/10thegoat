"use client";

import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { dictionaries, type Locale } from "@/lib/i18n";

const languageOptions: { locale: Locale; flag: string }[] = [
  { locale: "es", flag: "/flags/es.svg" },
  { locale: "en", flag: "/flags/gb.svg" },
  { locale: "fr", flag: "/flags/fr.svg" },
];

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, dictionary } = useI18n();

  function change(next: Locale) {
    const parts = pathname.split("/");
    parts[1] = next;
    document.cookie = `10tg-locale=${next};path=/;max-age=31536000;samesite=lax`;
    router.push(parts.join("/") || `/${next}`);
  }

  return <div className="language-switcher" role="group" aria-label={dictionary.nav.language}>
    {languageOptions.map((option) => (
      <button
        type="button"
        key={option.locale}
        className={option.locale === locale ? "is-active" : ""}
        onClick={() => change(option.locale)}
        aria-label={dictionaries[option.locale].languageName}
        aria-pressed={option.locale === locale}
        title={dictionaries[option.locale].languageName}
        lang={option.locale}
      >
        <img src={option.flag} alt="" width={24} height={16} />
        <span>{option.locale.toUpperCase()}</span>
      </button>
    ))}
  </div>;
}
