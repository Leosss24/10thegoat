export type GameScoreStats = {
  points: number;
  played: number;
  wins: number;
  bestScore: number;
  hintsUsed: number;
  surrenders: number;
};

export type GameResultInput = {
  score: number;
  won: boolean;
  usedHint?: boolean;
  surrendered?: boolean;
};

const STORAGE_KEY = "10tg-game-scores-v1";

const EMPTY_STATS: GameScoreStats = {
  points: 0,
  played: 0,
  wins: 0,
  bestScore: 0,
  hintsUsed: 0,
  surrenders: 0,
};

type ScoreStore = Record<string, GameScoreStats>;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStore(): ScoreStore {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeStats(value?: Partial<GameScoreStats>): GameScoreStats {
  const nonNegative = (candidate: unknown) => {
    const number = Number(candidate);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  };
  return {
    points: nonNegative(value?.points),
    played: nonNegative(value?.played),
    wins: nonNegative(value?.wins),
    bestScore: nonNegative(value?.bestScore),
    hintsUsed: nonNegative(value?.hintsUsed),
    surrenders: nonNegative(value?.surrenders),
  };
}

function normalizeForGame(gameKey: string, value?: Partial<GameScoreStats>): GameScoreStats {
  const stats = normalizeStats(value);
  if (gameKey === "mayor-o-menor" && stats.bestScore >= 10) {
    stats.wins = Math.max(stats.wins, Math.floor(stats.bestScore / 10));
  }
  return stats;
}

export function getGameScore(gameKey: string): GameScoreStats {
  const store = readStore();
  return normalizeForGame(gameKey, store[gameKey] ?? EMPTY_STATS);
}

export function getAllGameScores(): ScoreStore {
  const store = readStore();
  return Object.fromEntries(
    Object.entries(store).map(([gameKey, stats]) => [gameKey, normalizeForGame(gameKey, stats)]),
  );
}

export function recordGameResult(gameKey: string, result: GameResultInput): GameScoreStats {
  const store = readStore();
  const current = normalizeForGame(gameKey, store[gameKey]);
  const next: GameScoreStats = {
    points: Math.max(0, current.points + result.score),
    played: current.played + 1,
    wins: current.wins + (result.won ? 1 : 0),
    bestScore: Math.max(0, current.bestScore, result.score),
    hintsUsed: current.hintsUsed + (result.usedHint ? 1 : 0),
    surrenders: current.surrenders + (result.surrendered ? 1 : 0),
  };

  store[gameKey] = next;
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  return next;
}


export function addGamePoints(gameKey: string, points: number): GameScoreStats {
  const store = readStore();
  const current = normalizeForGame(gameKey, store[gameKey]);
  const next: GameScoreStats = {
    ...current,
    points: Math.max(0, current.points + points),
    bestScore: Math.max(0, current.bestScore, points),
    wins: current.wins + 1,
  };

  store[gameKey] = next;
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  return next;
}

export function getGlobalScore(): number {
  const store = readStore();
  return Math.max(0, Object.values(store).reduce((total, stats) => total + normalizeStats(stats).points, 0));
}
