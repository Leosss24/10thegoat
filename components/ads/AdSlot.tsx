"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { adsCopy } from "@/lib/ads/copy";
import type { AdPlacement } from "@/lib/ads/config";
import { useAds } from "./AdsProvider";

export default function AdSlot({ placement }: { placement: AdPlacement }) {
  const pathname = usePathname();
  return <RouteAdSlot key={`${pathname}:${placement}`} placement={placement} />;
}

function RouteAdSlot({ placement }: { placement: AdPlacement }) {
  const { config, allowed, scriptReady } = useAds();
  const { locale } = useI18n();
  const copy = adsCopy[locale];
  const frame = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLModElement>(null);
  const requested = useRef(false);
  const [visible, setVisible] = useState(false);
  const slot = config.slots[placement];
  const enabled = config.mode === "preview" || (config.mode === "live" && !!slot);

  useEffect(() => {
    const target = frame.current;
    if (!target || config.mode !== "live" || !allowed || !scriptReady || requested.current) return;
    function reveal() {
      if (!target || document.visibilityState !== "visible") return;
      const bounds = target.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0 && bounds.top < window.innerHeight && bounds.bottom > 0) setVisible(true);
    }
    const observer = new IntersectionObserver(reveal);
    observer.observe(target);
    document.addEventListener("visibilitychange", reveal);
    reveal();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", reveal); };
  }, [allowed, scriptReady, config.mode, slot]);

  useEffect(() => {
    const ad = element.current;
    if (!ad || !allowed || !scriptReady || !visible || requested.current) return;
    // Insert only eligible units: AdSense's push selects the first unfilled ins.
    // Never queue hidden units and never retry/refresh within the same route.
    requested.current = true;
    if (!ad.hasAttribute("data-adsbygoogle-status")) {
      try { (window.adsbygoogle ||= [] as Record<string, never>[]).push({}); }
      catch { /* Ad blockers must not affect games. */ }
    }
  }, [allowed, scriptReady, visible]);

  if (!enabled) return null;
  return <aside className="ad-space" aria-label={copy.label} data-placement={placement} data-ad-mode={config.mode}>
    <span className="ad-space-label">{copy.label}</span>
    <div ref={frame} className="ad-space-frame">
      {config.mode === "preview" ? <div className="ad-space-preview">{copy.preview}</div>
        : allowed && visible && <ins ref={element} className="adsbygoogle ad-space-unit"
          style={{ display: "block" }} data-ad-client={config.client} data-ad-slot={slot}
          data-full-width-responsive="false" />}
    </div>
  </aside>;
}
