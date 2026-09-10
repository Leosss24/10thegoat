"use client";

import { useEffect } from "react";
import { setScorePersistence } from "@/lib/game-scores";
import { supabase } from "@/lib/supabase";

export default function AccountScoreStorage() {
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setScorePersistence(Boolean(data.user));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setScorePersistence(Boolean(session?.user)));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return null;
}
