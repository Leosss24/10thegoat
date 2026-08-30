import { apiGet } from "./lib/core-importer.mjs";

const id = process.argv[2];
if (!id || !/^\d+$/.test(id)) {
  console.error("Uso: npm run inspect:player-id -- <API_FOOTBALL_ID>");
  process.exit(1);
}

const data = await apiGet(`/players/profiles?player=${encodeURIComponent(id)}`);
const entry = data.response?.[0];
const player = entry?.player ?? entry;

if (!player?.id) {
  console.log(`No se encontró ningún perfil para API ID ${id}.`);
  process.exit(2);
}

console.log("\n🐐 API-Football · Perfil encontrado\n");
console.log(`ID:           ${player.id}`);
console.log(`Nombre:       ${player.name ?? "-"}`);
console.log(`Nombre real:  ${[player.firstname, player.lastname].filter(Boolean).join(" ") || "-"}`);
console.log(`Nacimiento:   ${player.birth?.date ?? "-"}`);
console.log(`Nacionalidad: ${player.nationality ?? "-"}`);
console.log(`Foto:         ${player.photo ?? "-"}`);
