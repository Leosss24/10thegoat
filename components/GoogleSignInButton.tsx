"use client";

import { supabase } from "@/lib/supabase";

export function GoogleMark() {
  return <svg aria-hidden="true" className="google-sign-in__mark" viewBox="0 0 18 18"><path fill="#EA4335" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.568 2.683-3.876 2.683-6.614Z"/><path fill="#4285F4" d="M9 18c2.43 0 4.467-.806 5.957-2.181l-2.91-2.258c-.806.54-1.837.858-3.047.858-2.343 0-4.328-1.584-5.036-3.71H.956v2.332A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.964 10.709A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.709V4.959H.956A9 9 0 0 0 0 9c0 1.453.348 2.828.956 4.041l3.008-2.332Z"/><path fill="#34A853" d="M9 3.58c1.321 0 2.508.454 3.442 1.345l2.581-2.581C13.463.891 11.426 0 9 0a9 9 0 0 0-8.044 4.959l3.008 2.332C4.672 5.164 6.657 3.58 9 3.58Z"/></svg>;
}

export default function GoogleSignInButton({ locale }: { locale: "es" | "en" | "fr" }) {
  const label = locale === "es" ? "Continuar con Google" : locale === "fr" ? "Continuer avec Google" : "Continue with Google";
  const login = () => {
    if (!supabase) return;
    void supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href } });
  };

  return <button type="button" className="google-sign-in" onClick={login} disabled={!supabase}><GoogleMark /><span>{label}</span></button>;
}
