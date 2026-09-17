import { notFound } from "next/navigation";
import TriviaChallengePage from "@/components/games/TriviaChallengePage";
import { isLocale } from "@/lib/i18n";
import { challengeCopy } from "@/lib/trivia/challenge-copy";
import { challengeCatalogPath } from "@/lib/trivia/challenge";
import { challengeMetadata } from "@/lib/trivia/challenge-metadata";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = challengeCopy[locale];
  return challengeMetadata(locale, challengeCatalogPath, t.catalogTitle, t.catalogIntro);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <TriviaChallengePage locale={locale} />;
}
