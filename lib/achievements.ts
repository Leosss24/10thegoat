import type { CareerState } from "./career/types.ts";

export const achievementDefinitions = [
  { id: "career.debut", test: (s: CareerState) => s.totals.appearances > 0 },
  { id: "career.first_goal", test: (s: CareerState) => s.totals.goals > 0 || s.totals.cleanSheets > 0 },
  { id: "career.centurion", test: (s: CareerState) => s.totals.appearances >= 100 },
  { id: "career.champion", test: (s: CareerState) => s.totals.titles > 0 },
  { id: "career.international", test: (s: CareerState) => s.totals.internationalCaps > 0 },
  { id: "career.legend", test: (s: CareerState) => s.legacyScore >= 2500 },
] as const;

export function evaluateCareerAchievements(state: CareerState) {
  const unlocked = new Set(state.unlockedAchievementIds);
  for (const definition of achievementDefinitions) if (definition.test(state)) unlocked.add(definition.id);
  return [...unlocked];
}
