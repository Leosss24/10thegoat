export const placements = ["home-top", "home-bottom", "catalog-top", "catalog-bottom", "game-top", "game-bottom"] as const;
export type AdPlacement = (typeof placements)[number];
export type AdsConfig = {
  mode: "off" | "preview" | "live";
  client: string;
  slots: Partial<Record<AdPlacement, string>>;
};

type Environment = Record<string, string | undefined>;
const publisherPattern = /^ca-pub-\d{16}$/;

export function validPublisher(value: string | undefined): value is string {
  return !!value && publisherPattern.test(value);
}

// Read on the server only. Static pages capture these values at build time.
export function getAdsConfig(env: Environment): AdsConfig {
  const slots: AdsConfig["slots"] = {};
  for (const placement of placements) {
    const value = env[`ADS_SLOT_${placement.replaceAll("-", "_").toUpperCase()}`];
    if (value && /^\d{10}$/.test(value)) slots[placement] = value;
  }
  const client = validPublisher(env.ADSENSE_CLIENT_ID) ? env.ADSENSE_CLIENT_ID : "";
  const live = env.ADS_MODE === "live" && env.NODE_ENV === "production"
    && env.ADS_DEPLOYMENT === "production" && env.ADS_CMP_READY === "true"
    && (!env.VERCEL_ENV || env.VERCEL_ENV === "production") && !!client;
  return { mode: env.ADS_MODE === "preview" ? "preview" : live ? "live" : "off", client, slots };
}

export function isProductionOrigin(origin: string): boolean {
  return origin === "https://10thegoat.com" || origin === "https://www.10thegoat.com";
}

export function getVerificationClient(env: Environment): string | undefined {
  return env.ADS_VERIFICATION_ENABLED === "true" && validPublisher(env.ADSENSE_CLIENT_ID)
    ? env.ADSENSE_CLIENT_ID : undefined;
}

export function adsTxt(env: Environment): string | null {
  const client = getVerificationClient(env);
  return client ? `google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n` : null;
}
