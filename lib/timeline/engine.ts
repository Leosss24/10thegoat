import type { TimelineChallenge, TimelineEvent } from "./data.ts";
export type TimelineState = { version: 1; queue: string[]; index: number; order: string[]; checked: boolean; score: number };
const shuffle = <T,>(items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
export function eventDate(event: TimelineEvent) { return event.date ?? `${event.year}-01-01`; }
export function orderedEvents(challenge: TimelineChallenge) { return [...challenge.events].sort((a, b) => eventDate(a).localeCompare(eventDate(b))); }
function eventOrder(challenge: TimelineChallenge) {
  const correct = orderedEvents(challenge).map(e => e.id);
  const order = shuffle(correct);
  if (order.every((id, i) => id === correct[i])) [order[0], order[1]] = [order[1], order[0]];
  return order;
}
export function newTimeline(bank: TimelineChallenge[], previousId?: string): TimelineState {
  const queue = shuffle(bank.map(c => c.id));
  if (queue.length > 1 && queue[0] === previousId) [queue[0], queue[1]] = [queue[1], queue[0]];
  return { version: 1, queue, index: 0, order: eventOrder(bank.find(c => c.id === queue[0])!), checked: false, score: 0 };
}
export function restoreTimeline(value: unknown, bank: TimelineChallenge[]): TimelineState | null {
  if (!value || typeof value !== "object") return null;
  const s = value as TimelineState;
  if (s.version !== 1 || !Array.isArray(s.queue) || !s.queue.length || new Set(s.queue).size !== s.queue.length || !s.queue.every(id => bank.some(c => c.id === id)) || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.queue.length) return null;
  const c = bank.find(c => c.id === s.queue[s.index])!;
  if (!Array.isArray(s.order) || s.order.length !== 5 || new Set(s.order).size !== 5 || !s.order.every(id => c.events.some(e => e.id === id)) || typeof s.checked !== "boolean" || !Number.isInteger(s.score)) return null;
  const correct = orderedEvents(c);
  const expected = s.checked ? s.order.filter((id, i) => id === correct[i].id).length * 20 : 0;
  if (s.score !== expected) return null;
  return { ...s, queue: [...s.queue, ...shuffle(bank.map(c => c.id).filter(id => !s.queue.includes(id)))] };
}
export function checkTimeline(s: TimelineState, bank: TimelineChallenge[]): TimelineState {
  if (s.checked) return s;
  const c = bank.find(c => c.id === s.queue[s.index]);
  if (!c) return s;
  const correct = orderedEvents(c);
  return { ...s, checked: true, score: s.order.filter((id, i) => id === correct[i].id).length * 20 };
}
export function nextTimeline(s: TimelineState, bank: TimelineChallenge[]): TimelineState {
  if (!s.checked) return s;
  const index = s.index + 1;
  if (index >= s.queue.length) return newTimeline(bank, s.queue[s.index]);
  return { ...s, index, order: eventOrder(bank.find(c => c.id === s.queue[index])!), checked: false, score: 0 };
}
