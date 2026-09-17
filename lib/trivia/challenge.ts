import type { Question } from "./engine.ts";

export type ChallengeQuestion = Omit<Question, "difficulty"> & { difficulty: "medium" | "hard" };

export type ChallengeState = { answers: string[]; revealed: boolean; attempt: number };
export const challengeCatalogPath = "/juegos/trivia/retos";
export const challengePathFor = (id: string) => `/juegos/trivia/reto/${id}`;
export const initialChallenge: ChallengeState = { answers: [], revealed: false, attempt: 1 };

export function answerChallenge(state: ChallengeState, questions: ChallengeQuestion[], option: string): ChallengeState {
  const question = questions[state.answers.length];
  if (!question || state.revealed || !question.options.some(o => o.id === option)) return state;
  return { ...state, answers: [...state.answers, option], revealed: true };
}

export function challengeScore(state: ChallengeState, questions: ChallengeQuestion[]) {
  return state.answers.reduce((score, option, i) => score + Number(option === questions[i]?.correctOptionId), 0);
}

export function isChallengeState(value: unknown, questions: ChallengeQuestion[]): value is ChallengeState {
  if (!value || typeof value !== "object") return false;
  const s = value as ChallengeState;
  return Number.isSafeInteger(s.attempt) && s.attempt > 0 && typeof s.revealed === "boolean"
    && Array.isArray(s.answers) && s.answers.length <= questions.length
    && s.answers.every((option, i) => questions[i].options.some(o => o.id === option))
    && !(s.revealed && s.answers.length === 0);
}
