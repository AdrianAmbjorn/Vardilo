"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function BirthdaySettings({ memberId, name }: { memberId: string; name?: string }) {
 const { t, language, locale } = useLanguage();

 const supabase = useMemo(() => createClient(), []);
 const [date, setDate] = useState("");
 const [ready, setReady] = useState(false);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");
 useEffect(() => {
  let active = true;
  setReady(false); setDate(""); setMessage("");
  void Promise.resolve(supabase.from("member_birthdays").select("birth_date").eq("member_id", memberId).maybeSingle()).then(({ data, error }) => {
   if (!active) return;
   if (error) { setMessage("Kunde inte hämta födelsedatumet. Uppdatera sidan för att försöka igen."); return; }
   setDate(data?.birth_date ?? ""); setReady(true);
  }).catch(() => { if (active) setMessage("Kunde inte hämta födelsedatumet."); });
  return () => { active = false; };
 }, [memberId, supabase]);
 async function save(event: React.FormEvent) {
  event.preventDefault(); if (!ready || busy || !date) return;
  setBusy(true); setMessage("");
  try {
   const { error } = await supabase.from("member_birthdays").upsert({ member_id: memberId, birth_date: date, updated_at: new Date().toISOString() }).select("member_id").single();
   if (error) throw error;
   setMessage("Sparat. Familjen får en påminnelse på födelsedagen.");
  } catch { setMessage("Kunde inte spara. Kontrollera datumet och försök igen."); }
  finally { setBusy(false); }
 }
 return <form onSubmit={save} style={{ display: "grid", gap: 10, margin: "20px 0", maxWidth: 420 }}>
  <label className="family-admin-field"><span>{name ? language === "en" ? `Date of birth · ${name}` : `Födelsedatum · ${name}` : t("När är du född?")}</span><input type="date" value={date} min="1900-01-01" max={new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Stockholm"}).format(new Date())} required disabled={!ready || busy} onChange={event => setDate(event.target.value)} /></label>
  <p className="muted" style={{ margin: 0 }}>{t("Familjen påminns klockan 09 på födelsedagen. Push behöver vara påslaget på varje enhet.")}</p>
  <div><button className="secondary" disabled={!ready || busy || !date}>{busy ? t("Sparar…") : t("Spara födelsedatum")}</button></div>
  {message && <p role="status">{t(message)}</p>}
 </form>;
}
