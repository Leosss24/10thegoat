"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { adsCopy } from "@/lib/ads/copy";
import { useAds } from "./AdsProvider";

export default function PrivacyPreferences() {
  const { config, openPrivacy } = useAds();
  const { locale } = useI18n();
  const [failed, setFailed] = useState(false);
  if (config.mode !== "live") return null;
  return <span className="privacy-preferences">
    <button type="button" onClick={() => setFailed(!openPrivacy())}>{adsCopy[locale].settings}</button>
    {failed && <span role="status">{adsCopy[locale].unavailable}</span>}
  </span>;
}
