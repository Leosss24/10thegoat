import type { ConnectionPuzzle } from "./data.ts";
export type ConnectionsState = { version: 2; puzzleId: string; queue: string[]; index: number; order: string[]; selected: string[]; solved: string[]; mistakes: number; finished: boolean; recorded: boolean };
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function board(puzzle: ConnectionPuzzle, queue: string[], index: number): ConnectionsState {
  return { version: 2, puzzleId: puzzle.id, queue, index, order: shuffle(puzzle.groups.flatMap(g => g.members.map(m => m.id))), selected: [], solved: [], mistakes: 4, finished: false, recorded: false };
}
export function newConnections(bank: ConnectionPuzzle[], previousId?: string): ConnectionsState {
  const queue = shuffle(bank.map(p => p.id));
  if (queue.length > 1 && queue[0] === previousId) [queue[0], queue[1]] = [queue[1], queue[0]];
  return board(bank.find(p => p.id === queue[0])!, queue, 0);
}
const uniqueStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(x => typeof x === "string") && new Set(value).size === value.length;
export function restoreConnections(value: unknown, bank: ConnectionPuzzle[], legacy: ConnectionPuzzle[] = []): ConnectionsState | null {
  if (!value || typeof value !== "object") return null;
  const s = value as ConnectionsState & { version: number };
  // Legacy v1 board has no queue. Its IDs and progress remain intact until completed.
  const version = (value as { version?: number }).version;
  if (version !== 1 && version !== 2) return null;
  const all = [...bank, ...legacy];
  const puzzle = all.find(p => p.id === s.puzzleId);
  if (!puzzle) return null;
  const ids = puzzle.groups.flatMap(g => g.members.map(m => m.id));
  if (!uniqueStrings(s.order) || s.order.length !== 16 || !s.order.every(id => ids.includes(id)) ||
      !uniqueStrings(s.solved) || !s.solved.every(id => puzzle.groups.some(g => g.id === id)) ||
      !uniqueStrings(s.selected) || s.selected.length > 4 || !s.selected.every(id => ids.includes(id)) ||
      !Number.isInteger(s.mistakes) || s.mistakes < 0 || s.mistakes > 4 ||
      s.selected.some(id => puzzle.groups.some(g => s.solved.includes(g.id) && g.members.some(m => m.id === id))) ||
      typeof s.finished !== "boolean" || typeof s.recorded !== "boolean" ||
      s.finished !== (s.mistakes === 0 || s.solved.length === 4) || s.recorded !== s.finished || (s.finished && s.selected.length)) return null;
  if (version === 1) {
    const queue = [puzzle.id, ...shuffle(bank.map(p => p.id).filter(id => id !== puzzle.id))];
    return { ...s, version: 2, queue, index: 0 };
  }
  if (!uniqueStrings(s.queue) || !s.queue.length || !s.queue.every(id => all.some(p => p.id === id)) || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.queue.length || s.queue[s.index] !== puzzle.id) return null;
  return { ...s, queue: [...s.queue, ...shuffle(bank.map(p => p.id).filter(id => !s.queue.includes(id)))] };
}
export function selectConnection(s: ConnectionsState, puzzle: ConnectionPuzzle, id: string): ConnectionsState {
  if (s.finished || !puzzle.groups.some(g => !s.solved.includes(g.id) && g.members.some(m => m.id === id))) return s;
  const selected = s.selected.includes(id) ? s.selected.filter(x => x !== id) : s.selected.length < 4 ? [...s.selected, id] : s.selected;
  return { ...s, selected };
}
export function checkConnection(s: ConnectionsState, puzzle: ConnectionPuzzle) {
  if (s.finished || s.selected.length !== 4 || puzzle.id !== s.puzzleId) return { state: s, correct: false, award: null };
  const group = puzzle.groups.find(g => !s.solved.includes(g.id) && g.members.every(m => s.selected.includes(m.id)));
  const solved = group ? [...s.solved, group.id] : s.solved;
  const mistakes = s.mistakes - (group ? 0 : 1);
  const finished = solved.length === 4 || mistakes === 0;
  const won = solved.length === 4;
  return { state: { ...s, solved, mistakes, selected: [], finished, recorded: finished }, correct: Boolean(group), award: finished && !s.recorded ? { score: won ? 400 - (4 - mistakes) * 50 : 0, won } : null };
}
export function nextConnections(s: ConnectionsState, bank: ConnectionPuzzle[]): ConnectionsState {
  if (!s.finished) return s;
  const next = s.index + 1;
  const puzzle = bank.find(p => p.id === s.queue[next]);
  return puzzle ? board(puzzle, s.queue, next) : newConnections(bank, s.puzzleId);
}
