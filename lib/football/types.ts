export type CompetitionScope = "domestic" | "continental" | "international";
export type CompetitionType = "league" | "cup" | "super_cup" | "tournament" | "other";
export type MediaLicenseStatus =
  | "owned"
  | "open_license"
  | "provider_supplied"
  | "permission_required"
  | "unknown";

export interface CountrySummary {
  id: number;
  name: string;
  code?: string | null;
  flag_emoji?: string | null;
}

export interface PlayerSummary {
  id: number;
  display_name: string;
  full_name?: string | null;
  photo_url?: string | null;
  nationality?: CountrySummary | null;
}

export interface ClubSummary {
  id: number;
  name: string;
  badge_url?: string | null;
  country?: CountrySummary | null;
  is_national_team?: boolean;
}

export interface CompetitionSummary {
  id: number;
  name: string;
  scope: CompetitionScope;
  competition_type: CompetitionType;
  country?: CountrySummary | null;
}

export interface MediaAsset {
  id: string;
  player_id?: number | null;
  club_id?: number | null;
  asset_type: "portrait" | "badge" | "other";
  provider: string;
  provider_url?: string | null;
  storage_path?: string | null;
  license_status: MediaLicenseStatus;
  is_primary: boolean;
}
