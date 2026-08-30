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
  return {
    points: Number(value?.points) || 0,
    played: Number(value?.played) || 0,
    wins: Number(value?.wins) || 0,
    bestScore: Number(value?.bestScore) || 0,
    hintsUsed: Number(value?.hintsUsed) || 0,
    surrenders: Number(value?.surrenders) || 0,
  };
}

export function getGameScore(gameKey: string): GameScoreStats {
  const store = readStore();
  return normalizeStats(store[gameKey] ?? EMPTY_STATS);
}

export function recordGameResult(gameKey: string, result: GameResultInput): GameScoreStats {
  const store = readStore();
  const current = normalizeStats(store[gameKey]);
  const next: GameScoreStats = {
    points: current.points + result.score,
    played: current.played + 1,
    wins: current.wins + (result.won ? 1 : 0),
    bestScore: Math.max(current.bestScore, result.score),
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
  const current = normalizeStats(store[gameKey]);
  const next: GameScoreStats = {
    ...current,
    points: current.points + points,
    bestScore: Math.max(current.bestScore, points),
  };

  store[gameKey] = next;
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  return next;
}

export function getGlobalScore(): number {
  const store = readStore();
  return Object.values(store).reduce((total, stats) => total + normalizeStats(stats).points, 0);
}
