"use client";

import Script from "next/script";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { isProductionOrigin, type AdsConfig } from "@/lib/ads/config";
import { mayRequestAds, type ConsentData } from "@/lib/ads/consent";

type FcCallback = (() => void) | Record<string, () => void>;
type GoogleFc = {
  callbackQueue: { push: (callback: FcCallback) => unknown };
  showRevocationMessage?: () => void;
};
declare global {
  interface Window {
    adsbygoogle?: { push: (request: Record<string, never>) => unknown };
    googlefc?: GoogleFc;
    __tcfapi?: (command: string, version: number, callback: (data: ConsentData, success: boolean) => void, parameter?: number) => void;
  }
}

const AdsContext = createContext({
  config: { mode: "off", client: "", slots: {} } as AdsConfig,
  allowed: false,
  scriptReady: false,
  privacyReady: false,
  openPrivacy: (): boolean => false,
});
export const useAds = () => useContext(AdsContext);

const subscribeToOrigin = () => () => {};
const getOriginSnapshot = () => isProductionOrigin(window.location.origin);
const getServerOrigin = () => false;

export default function AdsProvider({ config, children }: { config: AdsConfig; children: ReactNode }) {
  const trustedOrigin = useSyncExternalStore(subscribeToOrigin, getOriginSnapshot, getServerOrigin);
  const [allowed, setAllowed] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [privacyReady, setPrivacyReady] = useState(false);

  useEffect(() => {
    if (config.mode !== "live" || !trustedOrigin) return;
    let active = true;
    let listenerId: number | undefined;
    const fc: GoogleFc = window.googlefc = window.googlefc || { callbackQueue: [] as FcCallback[] };
    fc.callbackQueue ||= [] as FcCallback[];
    fc.callbackQueue.push({ CONSENT_API_READY: () => {
      if (!active) return;
      setPrivacyReady(typeof fc.showRevocationMessage === "function");
      window.__tcfapi?.("addEventListener", 2, (data, success) => {
        listenerId = data?.listenerId;
        if (active) setAllowed(mayRequestAds(data, success));
      });
    } });
    return () => {
      active = false;
      if (listenerId !== undefined) window.__tcfapi?.("removeEventListener", 2, () => {}, listenerId);
    };
  }, [config.mode, trustedOrigin]);

  function openPrivacy() {
    const fc = window.googlefc;
    if (!trustedOrigin || !privacyReady || !fc?.showRevocationMessage) return false;
    setAllowed(false);
    fc.callbackQueue.push({ CONSENT_API_READY: () => fc.showRevocationMessage?.() });
    return true;
  }

  return <AdsContext.Provider value={{ config, allowed, scriptReady, privacyReady, openPrivacy }}>
    {children}
    {trustedOrigin && config.mode === "live" && <Script
      id="adsense-bootstrap"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onReady={() => setScriptReady(true)}
      onError={() => { setScriptReady(false); setAllowed(false); }}
    />}
  </AdsContext.Provider>;
}
