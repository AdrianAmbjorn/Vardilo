"use client";
import { useLanguage } from "./language-provider";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { homeSections, readHiddenSections, type HomeSectionId } from "@/lib/home-preferences";
import "./home-preferences.css";

const PreferencesContext = createContext<{ hidden: HomeSectionId[]; ready: boolean }>({ hidden: [], ready: false });

export function HomePreferences({ memberId, isChild, children }: { memberId: string | null; isChild: boolean; children: ReactNode }) {
 const { t, language, locale } = useLanguage();

  const supabase = useMemo(() => createClient(), []);
  const [hidden, setHidden] = useState<HomeSectionId[]>([]);
  const [draft, setDraft] = useState<HomeSectionId[]>([]);
  const [loadedMember, setLoadedMember] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const ready = memberId !== null && loadedMember === memberId;

  useEffect(() => {
    let active = true;
    setLoadedMember(null); setFailed(false); setError(""); setSaved(false); setEditing(false); setHidden([]);
    if (!memberId) return;
    void (async () => {
      try {
        const { data, error } = await supabase.from("member_home_preferences").select("hidden_sections").eq("member_id", memberId).maybeSingle();
        if (error) throw error;
        if (active) setHidden(readHiddenSections(data?.hidden_sections));
      } catch {
        if (active) { setFailed(true); setError("Dina val kunde inte hämtas. Standardvyn visas tills du försöker igen."); }
      } finally { if (active) setLoadedMember(memberId); }
    })();
    return () => { active = false; };
  }, [memberId, supabase, attempt]);

  async function save() {
    if (!memberId || !ready || failed || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSaved(false);
    try {
      const { error } = await supabase.from("member_home_preferences").upsert({ member_id: memberId, hidden_sections: draft }, { onConflict: "member_id" });
      if (error) throw error;
      setHidden(draft); setEditing(false); setSaved(true);
    } catch { setError("Dina val kunde inte sparas. Försök igen."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <PreferencesContext.Provider value={{ hidden, ready }}>
    <div className="home-personalize">
      <div><h2>{t("Din startsida")}</h2><p>{t("Det du vill ha nära till hands.")}</p></div>
      <button type="button" className="secondary" disabled={!ready || busy || failed} aria-expanded={editing} aria-controls="home-preferences-editor" onClick={() => { setDraft(hidden); setEditing(!editing); setSaved(false); setError(""); }}>{t("Anpassa startsidan")}</button>
    </div>
    {error && <p role="alert" className="home-preferences-error">{t(error)}{failed && <button type="button" className="secondary" onClick={() => setAttempt(value => value + 1)}>{t("Försök igen")}</button>}</p>}
    {saved && <p role="status" className="home-preferences-status">{t("Din startsida är sparad.")}</p>}
    {editing && <section id="home-preferences-editor" className="card home-preferences-editor" aria-label={t("Anpassa startsidan")}>
      <h3>{t("Vad vill du se?")}</h3><p>{t("Välj det som passar dig. Dina val gäller bara din startsida och följer med när du loggar in på en annan enhet.")}</p>
      <div className="home-preferences-options">{homeSections.filter(section => isChild ? section.id !== "budget" : section.id !== "xp" && section.id !== "savings").map(section => <label key={section.id}><span aria-hidden="true">{section.emoji}</span><span>{t(section.label)}</span><input type="checkbox" checked={!draft.includes(section.id)} disabled={busy} onChange={event => setDraft(current => event.target.checked ? current.filter(id => id !== section.id) : [...current, section.id])} /></label>)}</div>
      <div className="home-preferences-actions"><button className="primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? t("Sparar…") : t("Spara mina val")}</button><button className="secondary" type="button" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>{t("Avbryt")}</button></div>
      <p className="home-preferences-note">{t("Allt finns kvar i menyn, även det du döljer här.")}</p>
    </section>}
    {ready && homeSections.filter(section => isChild ? section.id !== "budget" : section.id !== "xp" && section.id !== "savings").every(section => hidden.includes(section.id)) && <p className="home-preferences-status">{t("Du har valt en lugn startsida. Öppna menyn för att hitta allt, eller välj vad du vill visa här.")}</p>}
    <div className="home-widget-grid">{children}</div>
  </PreferencesContext.Provider>;
}

export function HomeSection({ id, children }: { id: HomeSectionId; children: ReactNode }) {
  const { hidden, ready } = useContext(PreferencesContext);
  return ready && !hidden.includes(id) ? children : null;
}
