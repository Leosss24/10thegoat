export type Locale = "es" | "en" | "fr";
export type Translation = Record<Locale, string>;
export type Difficulty = "easy" | "hard";

export type OddChallenge = {
  id: string;
  difficulty: Difficulty;
  category: Translation;
  options: { id: string; label: string }[];
  oddOptionId: string;
  commonReason: Translation;
  oddReason: Translation;
  source: string;
};

export type OddRound = {
  difficulty: Difficulty;
  queue: string[];
  index: number;
  optionOrder: string[];
  streak: number;
  points: number;
  selected: string | null;
  finished: boolean;
  lastAward: number;
};

export type OddSession = { bankVersion: 1; difficulty: Difficulty; rounds: Partial<Record<Difficulty, OddRound>> };

export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function newOddRound(bank: OddChallenge[], difficulty: Difficulty): OddRound {
  const pool = bank.filter(item => item.difficulty === difficulty);
  if (!pool.length) throw new Error("Empty odd-one-out pool");
  const queue = shuffled(pool.map(item => item.id));
  const first = pool.find(item => item.id === queue[0])!;
  return { difficulty, queue, index: 0, optionOrder: shuffled(first.options.map(option => option.id)), streak: 0, points: 0, selected: null, finished: false, lastAward: 0 };
}

export function answerOdd(round: OddRound, challenge: OddChallenge, optionId: string, bestStreak: number): OddRound {
  if (round.finished || round.selected !== null || challenge.id !== round.queue[round.index] || !challenge.options.some(option => option.id === optionId)) return round;
  const correct = optionId === challenge.oddOptionId;
  const streak = round.streak + (correct ? 1 : 0);
  const lastAward = correct && streak > Math.max(0, bestStreak) ? streak * 10 : 0;
  return { ...round, selected: optionId, streak, points: round.points + lastAward, lastAward, finished: !correct };
}

export function nextOdd(round: OddRound, bank: OddChallenge[]): OddRound {
  if (round.finished || round.selected === null) return round;
  let queue = round.queue;
  let index = round.index + 1;
  if (index === queue.length) {
    queue = shuffled(queue);
    if (queue.length > 1 && queue[0] === round.queue[round.index]) [queue[0], queue[1]] = [queue[1], queue[0]];
    index = 0;
  }
  const challenge = bank.find(item => item.id === queue[index])!;
  return { ...round, queue, index, optionOrder: shuffled(challenge.options.map(option => option.id)), selected: null, lastAward: 0 };
}

const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

export function isOddSession(value: unknown, bank: OddChallenge[]): value is OddSession {
  if (!value || typeof value !== "object") return false;
  const session = value as OddSession;
  if (session.bankVersion !== 1 || !["easy", "hard"].includes(session.difficulty) || !session.rounds || typeof session.rounds !== "object") return false;
  for (const [difficulty, round] of Object.entries(session.rounds)) {
    if (!round || round.difficulty !== difficulty || !["easy", "hard"].includes(difficulty)) return false;
    const pool = bank.filter(item => item.difficulty === difficulty);
    if (!Array.isArray(round.queue) || !round.queue.length || round.queue.length > pool.length || new Set(round.queue).size !== round.queue.length || !round.queue.every(id => pool.some(item => item.id === id))) return false;
    if (!integer(round.index) || round.index >= round.queue.length || !integer(round.streak) || !integer(round.points) || !integer(round.lastAward)) return false;
    const challenge = pool.find(item => item.id === round.queue[round.index])!;
    if (!Array.isArray(round.optionOrder) || round.optionOrder.length !== 4 || new Set(round.optionOrder).size !== 4 || !round.optionOrder.every(id => challenge.options.some(option => option.id === id))) return false;
    if (!(round.selected === null || challenge.options.some(option => option.id === round.selected)) || typeof round.finished !== "boolean") return false;
    const wrong = round.selected !== null && round.selected !== challenge.oddOptionId;
    if (round.finished !== wrong || round.lastAward > round.points || (round.selected === null && round.lastAward !== 0)) return false;
    const expectedIndex = (round.streak - (round.selected === challenge.oddOptionId ? 1 : 0)) % round.queue.length;
    if (round.index !== expectedIndex) return false;
  }
  return Boolean(session.rounds[session.difficulty]);
}
