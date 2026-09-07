export type Difficulty = "easy" | "hard";
export type Translation = { es: string; en: string; fr: string };
export type Question = {
  id: string;
  difficulty: Difficulty;
  category: Translation;
  prompt: Translation;
  options: { id: string; text: Translation }[];
  correctOptionId: string;
  explanation: Translation;
  source: string;
};
export type Round = {
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
export type TriviaSession = { bankVersion: 1; difficulty: Difficulty; rounds: Partial<Record<Difficulty, Round>> };

export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function newRound(bank: Question[], difficulty: Difficulty): Round {
  const questions = bank.filter(q => q.difficulty === difficulty);
  if (!questions.length) throw new Error("Empty trivia pool");
  const queue = shuffled(questions.map(q => q.id));
  const first = questions.find(q => q.id === queue[0])!;
  return { difficulty, queue, index: 0, optionOrder: shuffled(first.options.map(o => o.id)), streak: 0, points: 0, selected: null, finished: false, lastAward: 0 };
}

// Same award rule as HigherLowerGame: only a new personal best earns streak × 10.
export function answer(round: Round, question: Question, optionId: string, bestStreak: number): Round {
  if (round.finished || round.selected !== null || question.id !== round.queue[round.index] || !question.options.some(o => o.id === optionId)) return round;
  const correct = optionId === question.correctOptionId;
  const streak = round.streak + (correct ? 1 : 0);
  const lastAward = correct && streak > Math.max(0, bestStreak) ? streak * 10 : 0;
  return { ...round, selected: optionId, streak, lastAward, points: round.points + lastAward, finished: !correct };
}

export function nextQuestion(round: Round, bank: Question[]): Round {
  if (round.finished || round.selected === null) return round;
  let queue = round.queue;
  let index = round.index + 1;
  if (index === queue.length) {
    // A perfect cycle continues: only a wrong answer ends the game.
    queue = shuffled(queue);
    if (queue[0] === round.queue[round.index] && queue.length > 1) [queue[0], queue[1]] = [queue[1], queue[0]];
    index = 0;
  }
  const question = bank.find(q => q.id === queue[index])!;
  return { ...round, queue, index, optionOrder: shuffled(question.options.map(o => o.id)), selected: null, lastAward: 0 };
}

const integer = (x: unknown): x is number => Number.isSafeInteger(x) && Number(x) >= 0;
export function isTriviaSession(value: unknown, bank: Question[]): value is TriviaSession {
  if (!value || typeof value !== "object") return false;
  const session = value as TriviaSession;
  if (session.bankVersion !== 1 || !["easy", "hard"].includes(session.difficulty) || !session.rounds || typeof session.rounds !== "object") return false;
  for (const [difficulty, r] of Object.entries(session.rounds)) {
    if (!r || r.difficulty !== difficulty || !["easy", "hard"].includes(difficulty)) return false;
    const pool = bank.filter(q => q.difficulty === difficulty);
    // An additive bank update must not reset a game already in progress.
    // Existing games finish with their original pool; new games use the full bank.
    if (!Array.isArray(r.queue) || r.queue.length === 0 || r.queue.length > pool.length || new Set(r.queue).size !== r.queue.length || !r.queue.every(id => pool.some(q => q.id === id))) return false;
    if (!integer(r.index) || r.index >= r.queue.length || !integer(r.streak) || !integer(r.points) || !integer(r.lastAward)) return false;
    const q = pool.find(q => q.id === r.queue[r.index])!;
    if (!Array.isArray(r.optionOrder) || r.optionOrder.length !== 4 || new Set(r.optionOrder).size !== 4 || !r.optionOrder.every(id => q.options.some(o => o.id === id))) return false;
    if (typeof r.finished !== "boolean" || !(r.selected === null || q.options.some(o => o.id === r.selected))) return false;
    if (r.finished !== (r.selected !== null && r.selected !== q.correctOptionId)) return false;
    const expectedIndex = (r.streak - (r.selected === q.correctOptionId ? 1 : 0)) % r.queue.length;
    if (r.index !== expectedIndex || r.lastAward > r.points || (r.selected === null && r.lastAward !== 0)) return false;
  }
  return Boolean(session.rounds[session.difficulty]);
}
