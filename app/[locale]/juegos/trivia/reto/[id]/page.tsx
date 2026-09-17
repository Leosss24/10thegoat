import { notFound } from "next/navigation";
import TriviaChallengePage from "@/components/games/TriviaChallengePage";
import { isLocale } from "@/lib/i18n";
import { challengeCatalog } from "@/lib/trivia/challenge-catalog.server";
import { challengePathFor } from "@/lib/trivia/challenge";
import { challengeMetadata } from "@/lib/trivia/challenge-metadata";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) return {};
  const challenge = challengeCatalog().find(item => item.id === id);
  if (!challenge) return {};
  return challengeMetadata(locale, challengePathFor(id), challenge.title[locale], challenge.description[locale], challenge.available);
}

export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <TriviaChallengePage locale={locale} id={id} />;
}
