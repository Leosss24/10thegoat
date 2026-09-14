import snapshot from "../../data/players/catalog.json";
export type PlayerIdentity = { id: number; display_name: string; photo_url: string | null; aliases: string[] };
const players = snapshot.players as PlayerIdentity[];
const byId = new Map(players.map(player => [player.id, player]));
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const aliases = new Map<string, PlayerIdentity | null>();
for (const player of players) for (const alias of player.aliases) {
  const key = fold(alias);
  const existing = aliases.get(key);
  aliases.set(key, existing === undefined || existing?.id === player.id ? player : null);
}
export function playerIdentity(id?: number) { return id === undefined ? undefined : byId.get(id); }
export function playerDisplayName(id: number | undefined, fallback: string) {
  return (playerIdentity(id)?.display_name || aliases.get(fold(fallback))?.display_name || fallback).toUpperCase();
}
export function footballLabel(label: string) { return playerDisplayName(undefined, label); }
