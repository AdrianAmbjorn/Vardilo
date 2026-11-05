"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { languageFrom, translate, type Language } from "@/lib/i18n";

const LanguageContext = createContext({ language: "sv" as Language, locale: "sv-SE", t: (text: string) => text, saving: false, ready: false, error: "", changeLanguage: async (_language: Language) => {} });
export function LanguageProvider({ children }: { children: ReactNode }) {
 const supabase = useMemo(() => createClient(), []);
 const [language, setLanguage] = useState<Language>("sv");
 const [ready, setReady] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const identity = useRef<string | null>(null);
 const generation = useRef(0); const lock = useRef(false);
 const apply = useCallback((value: Language) => {
  setLanguage(value); document.documentElement.lang = value;
  document.cookie = `vardilo_language=${value}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
 }, []);
 useEffect(() => {
  let active = true;
  const browserLanguage = languageFrom(navigator.language);
  const cookie = document.cookie.split("; ").find(value => value.startsWith("vardilo_language="))?.split("=")[1];
  apply(cookie === "sv" || cookie === "en" ? cookie : browserLanguage);
  async function load() {
   const request = ++generation.current; setReady(false);
   try {
    const { data, error } = await supabase.auth.getUser();
    if (!active || request !== generation.current) return;
    if (error && error.name !== "AuthSessionMissingError") throw error;
    identity.current = data.user?.id ?? null;
    if (data.user) apply(languageFrom(data.user.user_metadata?.language ?? browserLanguage));
    setError("");
   } catch { if (active && request === generation.current) setError("Kunde inte hämta ditt språkval. Försök igen genom att uppdatera sidan."); }
   finally { if (active && request === generation.current) setReady(true); }
  }
  void load();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
   if (event === "SIGNED_OUT") { identity.current = null; generation.current++; setReady(true); setError(""); }
   else if (event === "SIGNED_IN" || event === "USER_UPDATED") { identity.current = session?.user.id ?? null; queueMicrotask(() => { if (active) void load(); }); }
  });
  return () => { active = false; generation.current++; data.subscription.unsubscribe(); };
 }, [supabase, apply]);
 const changeLanguage = useCallback(async (next: Language) => {
  if (lock.current || !ready) return;
  lock.current = true; setSaving(true); setError("");
  const actor = identity.current;
  try {
   const { data, error } = await supabase.auth.getUser();
   if (error && error.name !== "AuthSessionMissingError") throw error;
   if (identity.current !== actor || (data.user?.id ?? null) !== actor) return;
   if (data.user) { const result = await supabase.auth.updateUser({ data: { language: next } }); if (result.error) throw result.error; }
   // updateUser may emit USER_UPDATED and start a fresh identity read.
   if (identity.current === actor) apply(next);
  } catch { setError("Kunde inte spara språkvalet. Försök igen."); }
  finally { lock.current = false; setSaving(false); }
 }, [supabase, ready, apply]);
 const t = useCallback((text: string) => translate(text, language), [language]);
 return <LanguageContext.Provider value={{ language, locale: language === "en" ? "en-GB" : "sv-SE", t, changeLanguage, saving, ready, error }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguagePicker() {
 const { language, t, changeLanguage, saving, ready, error } = useLanguage();
 return <div style={{display:"grid",gap:8,margin:"16px 0"}}><label className="family-admin-field"><span>{t("Språk")}</span><select aria-label={t("Språk")} value={language} disabled={saving || !ready} onChange={event => void changeLanguage(event.target.value as Language)}><option value="sv">Svenska</option><option value="en">English (preview)</option></select></label>{error && <p role="alert">{t(error)}</p>}</div>;
}
