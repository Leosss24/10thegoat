import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { challengeCatalog } from "../../lib/trivia/challenge-catalog.server";
import { challengeCatalogPath, challengePathFor } from "../../lib/trivia/challenge";
import { challengeCopy } from "../../lib/trivia/challenge-copy";
import type { Locale } from "../../lib/i18n";
import TriviaChallenge from "./TriviaChallenge";
import "./TriviaGame.css";

export default async function TriviaChallengePage({ locale, id }: { locale: Locale; id?: string }) {
  await connection();
  const challenges = challengeCatalog();
  const t = challengeCopy[locale];
  const selected = id ? challenges.find(challenge => challenge.id === id) : null;
  if (id && !selected) notFound();
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Europe/Madrid" }).format(new Date(`${date}T12:00:00Z`));
  return <main className="game-shell game-room container trivia-page">
    <div className="game-room-heading"><Link href={`/${locale}${id ? challengeCatalogPath : "/juegos/trivia"}`} className="game-room-back">← {id ? t.catalogTitle : "TRIVIA"}</Link><div><span className="eyebrow">10theGOAT</span><h1>{selected ? selected.title[locale] : t.catalogTitle}</h1><p>{selected ? selected.description[locale] : t.catalogIntro}</p></div></div>
    {selected ? selected.available ? <TriviaChallenge key={`${selected.id}:${selected.version}`} id={selected.id} version={selected.version} title={selected.title[locale]} questions={selected.questions} /> : <section className="trivia-panel challenge-locked"><h2>{t.locked}</h2><p>{selected.opensOn ? `${t.opens} ${dateLabel(selected.opensOn)}` : t.upcoming}</p><p>{t.weekly}</p><Link className="btn btn-primary" href={`/${locale}${challengeCatalogPath}`}>{t.more}</Link></section> : <>
      <p className="challenge-calendar-note">{t.weekly}</p>
      <ol className="challenge-catalog">{challenges.map((challenge, index) => <li key={challenge.id} className={`trivia-panel challenge-card${challenge.available ? " is-available" : ""}`}>
        <span className="trivia-kicker">{String(index + 1).padStart(2, "0")} · {challenge.available ? t.available : t.locked}</span>
        <h2>{challenge.title[locale]}</h2><p>{challenge.description[locale]}</p><small>{t.difficulty}</small>
        {challenge.available ? <Link className="btn btn-primary" href={`/${locale}${challengePathFor(challenge.id)}`}>{t.start} ↗</Link> : <><p>{challenge.opensOn ? `${t.opens} ${dateLabel(challenge.opensOn)}` : t.upcoming}</p><button type="button" className="btn trivia-secondary" disabled>{t.locked}</button></>}
      </li>)}</ol>
    </>}
  </main>;
}
