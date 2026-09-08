export type Difficulty = 'easy' | 'hard';
export type Variant = 'country-club' | 'country-position' | 'club-club';
export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';
export type Axis = { kind: 'country' | 'club' | 'position'; id: string; name: string; image?: string; flag?: string };
export type GridPlayer = { id: number; name: string; aliases: string[]; photo: string; countryId: string; position: Position; clubIds: string[]; legend: boolean; currentClubIds?: string[] };
export type Board = { id: string; difficulty: Difficulty; variant: Variant; rows: Axis[]; columns: Axis[] };
export type Catalog = { version: string; exportedAt: string; players: GridPlayer[]; boards: Board[] };
export type GridRound = { id: string; catalog_version: string; difficulty: Difficulty; board: Board; answers: (number | null)[]; status: 'active' | 'won' | 'timeout' | 'surrendered'; started_at: string; expires_at: string; score: number };
export type GridStats = { points: number; played: number; wins: number; best_score: number; surrenders: number };
export type GridState = { round: GridRound | null; used: number; day: string; stats: GridStats; feedback?: string; server_now: string };

export const RULES = {
  easy: { seconds: 120, reward: 100, surrender: 20 },
  hard: { seconds: 90, reward: 200, surrender: 50 },
} as const;
export const DAILY_LIMIT = 3;
export const SIZE = 4;
export const POSITIONS: Position[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

export function matches(player: GridPlayer, axis: Axis): boolean {
  if (axis.kind === 'country') return player.countryId === axis.id;
  if (axis.kind === 'position') return player.position === axis.id;
  return player.clubIds.includes(axis.id);
}
export function candidates(board: Board, players: GridPlayer[]): number[][] {
  return board.rows.flatMap(row => board.columns.map(col => players.filter(p => matches(p, row) && matches(p, col)).map(p => p.id)));
}
// Bipartite matching proves that all 16 cells can be filled by DIFFERENT players.
export function solve(cells: number[][], fixed: (number | null)[] = []): number[] | null {
  if (fixed.some((id, i) => id !== null && id !== undefined && !cells[i]?.includes(id))) return null;
  const selected = fixed.filter((id): id is number => id !== null && id !== undefined);
  if (new Set(selected).size !== selected.length) return null;
  const locked = new Set(selected), owner = new Map<number, number>();
  const result = cells.map((_, i) => fixed[i] ?? 0);
  function assign(cell: number, seen: Set<number>): boolean {
    for (const player of cells[cell]) {
      if (locked.has(player) || seen.has(player)) continue;
      seen.add(player);
      const previous = owner.get(player);
      if (previous === undefined || assign(previous, seen)) {
        owner.set(player, cell); result[cell] = player; return true;
      }
    }
    return false;
  }
  for (const i of cells.map((_, i) => i).filter(i => !result[i]).sort((a, b) => cells[a].length - cells[b].length)) {
    if (!assign(i, new Set())) return null;
  }
  return result;
}
export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function searchPlayers(players: GridPlayer[], query: string, used: (number | null)[], limit = 12) {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];
  const tokens = normalized.split(' ');
  return players.filter(p => !used.includes(p.id) && tokens.every(token => normalizeSearch([p.name, ...p.aliases].join(' ')).includes(token)))
    .sort((a, b) => Number(normalizeSearch(b.name).startsWith(normalized)) - Number(normalizeSearch(a.name).startsWith(normalized)) || a.name.localeCompare(b.name)).slice(0, limit);
}
export function pointsAfter(current: number, difficulty: Difficulty, status: GridRound['status']) {
  const delta = status === 'won' ? RULES[difficulty].reward : status === 'surrendered' ? -RULES[difficulty].surrender : 0;
  return Math.max(0, current + delta);
}
