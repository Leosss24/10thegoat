import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const apiKey = process.env.API_FOOTBALL_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const TARGET = {
  label: "Lionel Messi",
  search: "Messi",
  birthDate: "1987-06-24",
  nationality: "Argentina",
};

if (!apiKey) {
  console.error("❌ Falta API_FOOTBALL_KEY en .env.local");
  process.exit(1);
}

if (!supabaseUrl) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
  process.exit(1);
}

if (!supabaseSecretKey) {
  console.error("❌ Falta SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseMeasure(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API-Football respondió ${response.status}`);
  }

  if (data?.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football devolvió errores: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

async function findMessi() {
  const data = await apiGet(`/players/profiles?search=${encodeURIComponent(TARGET.search)}`);
  const entries = data.response ?? [];

  const exact = entries.find((entry) => {
    const player = entry?.player ?? entry;
    return (
      player?.birth?.date === TARGET.birthDate &&
      normalize(player?.nationality) === normalize(TARGET.nationality)
    );
  });

  if (!exact) {
    throw new Error("No pude identificar exactamente a Lionel Messi.");
  }

  return exact?.player ?? exact;
}

async function ensureCountry(name) {
  const existing = await supabase
    .from("countries")
    .select("id,name")
    .eq("name", name)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await supabase
    .from("countries")
    .insert({ name })
    .select("id,name")
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function findExistingPlayerByExternalId(externalId) {
  const mapping = await supabase
    .from("player_external_ids")
    .select("player_id")
    .eq("provider", "api_football")
    .eq("external_id", String(externalId))
    .maybeSingle();

  if (mapping.error) throw mapping.error;
  return mapping.data?.player_id ?? null;
}

async function savePlayer(player, countryId) {
  const payload = {
    display_name: TARGET.label,
    full_name: [player.firstname, player.lastname].filter(Boolean).join(" ") || player.name || TARGET.label,
    first_name: player.firstname ?? null,
    last_name: player.lastname ?? null,
    birth_date: player.birth?.date ?? null,
    nationality_country_id: countryId,
    height_cm: parseMeasure(player.height),
    weight_kg: parseMeasure(player.weight),
    photo_url: player.photo ?? null,
    is_active: true,
    is_retired: false,
    updated_at: new Date().toISOString(),
  };

  const existingPlayerId = await findExistingPlayerByExternalId(player.id);

  if (existingPlayerId) {
    const updated = await supabase
      .from("players")
      .update(payload)
      .eq("id", existingPlayerId)
      .select("*")
      .single();

    if (updated.error) throw updated.error;
    return { player: updated.data, created: false };
  }

  const inserted = await supabase
    .from("players")
    .insert(payload)
    .select("*")
    .single();

  if (inserted.error) throw inserted.error;

  const mapping = await supabase.from("player_external_ids").insert({
    player_id: inserted.data.id,
    provider: "api_football",
    external_id: String(player.id),
  });

  if (mapping.error) {
    await supabase.from("players").delete().eq("id", inserted.data.id);
    throw mapping.error;
  }

  return { player: inserted.data, created: true };
}

async function main() {
  console.log("🐐 10 The GOAT · Importación de prueba");
  console.log("Jugador: Lionel Messi\n");

  console.log("1/3 Buscando a Messi en API-Football...");
  const apiPlayer = await findMessi();
  console.log(`✅ Encontrado: ${apiPlayer.name} · API-Football ID ${apiPlayer.id}`);

  console.log("\n2/3 Preparando Argentina en Supabase...");
  const country = await ensureCountry(apiPlayer.nationality || TARGET.nationality);
  console.log(`✅ País: ${country.name} · 10TG country_id ${country.id}`);

  console.log("\n3/3 Guardando jugador en Supabase...");
  const result = await savePlayer(apiPlayer, country.id);

  console.log(result.created ? "✅ Jugador creado." : "✅ Jugador ya existía: datos actualizados.");
  console.log("\nResultado:");
  console.log(`   10TG player_id: ${result.player.id}`);
  console.log(`   Nombre:          ${result.player.display_name}`);
  console.log(`   Nacimiento:      ${result.player.birth_date ?? "-"}`);
  console.log(`   Altura:          ${result.player.height_cm ? `${result.player.height_cm} cm` : "-"}`);
  console.log(`   Peso:            ${result.player.weight_kg ? `${result.player.weight_kg} kg` : "-"}`);
  console.log(`   Foto URL:        ${result.player.photo_url ?? "-"}`);
  console.log(`   API-Football ID: ${apiPlayer.id}`);
  console.log("\n🎉 Messi está en la base de datos de 10 The GOAT.");
}

main().catch((error) => {
  console.error("\n❌ Importación detenida:");
  console.error(error?.message ?? error);
  process.exit(1);
});
