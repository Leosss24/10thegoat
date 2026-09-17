import "server-only";
import type { ChallengeQuestion } from "./challenge";
import catalog from "../../data/trivia/challenges.json";
import { isReleased, releaseDate, validDate } from "./challenge-schedule";
import type { Translation } from "./engine";

export type TriviaChallengeDefinition = {
  id: string;
  version: number;
  unlockWeek: number;
  title: Translation;
  description: Translation;
  questions: ChallengeQuestion[];
};

export function challengeCatalog(now = new Date()) {
  const configured = process.env.TRIVIA_CHALLENGES_LAUNCH_DATE || catalog.launchDate;
  const launch = validDate(configured) ? configured : null;
  return (catalog.challenges as TriviaChallengeDefinition[]).map(challenge => ({
    ...challenge,
    available: isReleased(challenge.unlockWeek, launch, now),
    opensOn: releaseDate(launch, challenge.unlockWeek),
  }));
}
