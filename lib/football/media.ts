import type { ClubSummary, CompetitionSummary, MediaAsset, PlayerSummary } from "./types";

const WORLD_ICON = "🌍";

export function getPlayerPhotoUrl(player: Pick<PlayerSummary, "photo_url">) {
  return player.photo_url || null;
}

export function getClubBadgeUrl(club: Pick<ClubSummary, "badge_url">) {
  return club.badge_url || null;
}

export function getCompetitionVisual(competition: CompetitionSummary) {
  if (competition.scope === "domestic" && competition.country) {
    return {
      icon: competition.country.flag_emoji || "🏳️",
      label: competition.country.name,
    };
  }

  return {
    icon: WORLD_ICON,
    label: "Internacional",
  };
}

// Optional future media catalogue helper. Primary portraits/badges do not need it.
export function getMediaAssetUrl(
  asset: MediaAsset | null | undefined,
  supabasePublicBaseUrl?: string,
) {
  if (!asset) return null;

  if (asset.storage_path && supabasePublicBaseUrl) {
    return `${supabasePublicBaseUrl.replace(/\/$/, "")}/${asset.storage_path.replace(/^\//, "")}`;
  }

  return asset.provider_url || null;
}
