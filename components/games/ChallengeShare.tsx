"use client";

import { useState } from "react";
import { useI18n } from "../I18nProvider";
import { challengeCopy } from "../../lib/trivia/challenge-copy";

export default function ChallengeShare({ title, text, path }: { title: string; text: string; path: string }) {
  const { locale } = useI18n();
  const t = challengeCopy[locale];
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true); setStatus(""); setManual("");
    const url = new URL(path, window.location.origin).href;
    const message = `${text}\n${url}`;
    try {
      if (navigator.share) {
        try { await navigator.share({ title, text, url }); return; }
        catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(message); setStatus(t.copied); }
      catch { setManual(message); }
    } finally { setBusy(false); }
  }
  return <div className="challenge-share">
    <button type="button" className="btn btn-primary" disabled={busy} onClick={share}>{t.share}</button>
    <p role="status">{status}</p>
    {manual && <label>{t.manual}<textarea readOnly rows={6} value={manual} onFocus={event => event.currentTarget.select()} /></label>}
  </div>;
}
