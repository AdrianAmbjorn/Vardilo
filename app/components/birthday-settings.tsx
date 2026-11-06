"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useMemo, useState } from "react";
import { birthdayParts } from "@/lib/birthday-input";
import { createClient } from "@/lib/supabase/client";

export default function BirthdaySettings({ memberId, name }: { memberId: string; name?: string }) {
 const { t, language, locale } = useLanguage();

 const supabase = useMemo(() => createClient(), []);
 const [month, setMonth] = useState("");
 const [day, setDay] = useState("");
 const [ready, setReady] = useState(false);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");
 useEffect(() => {
  let active = true;
  setReady(false); setMonth(""); setDay(""); setMessage("");
  void Promise.resolve(supabase.from("member_birthdays").select("birthday_month,birthday_day").eq("member_id", memberId).maybeSingle()).then(({ data, error }) => {
   if (!active) return;
   if (error) { setMessage("Kunde inte hämta födelsedatumet. Uppdatera sidan för att försöka igen."); return; }
   setMonth(String(data?.birthday_month ?? "")); setDay(String(data?.birthday_day ?? "")); setReady(true);
  }).catch(() => { if (active) setMessage("Kunde inte hämta födelsedatumet."); });
  return () => { active = false; };
 }, [memberId, supabase]);
 async function save(event: React.FormEvent) {
  event.preventDefault(); if (!ready || busy || !month || !day) return;
  setBusy(true); setMessage("");
  try {
   const { error } = await supabase.from("member_birthdays").upsert({ member_id: memberId, ...birthdayParts(month, day), updated_at: new Date().toISOString() }).select("member_id").single();
   if (error) throw error;
   setMessage("Sparat. Familjen får en påminnelse på födelsedagen.");
  } catch { setMessage("Kunde inte spara. Kontrollera datumet och försök igen."); }
  finally { setBusy(false); }
 }
 return <form onSubmit={save} style={{ display: "grid", gap: 10, margin: "20px 0", maxWidth: 420 }}>
  <fieldset disabled={!ready || busy} style={{border:0,padding:0,margin:0}}><legend>{name ? `${language === "en" ? "Birthday" : "Födelsedag"} · ${name}` : language === "en" ? "Your birthday" : "Din födelsedag"}</legend><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label className="family-admin-field"><span>{language === "en" ? "Month" : "Månad"}</span><select value={month} onChange={event=>setMonth(event.target.value)} required><option value="">—</option>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Intl.DateTimeFormat(locale,{month:"long"}).format(new Date(2000,i,1))}</option>)}</select></label><label className="family-admin-field"><span>{language === "en" ? "Day" : "Dag"}</span><select value={day} onChange={event=>setDay(event.target.value)} required><option value="">—</option>{Array.from({length:31},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label></div></fieldset>
  <p className="muted" style={{ margin: 0 }}>{t("Familjen påminns klockan 09 på födelsedagen. Push behöver vara påslaget på varje enhet.")}</p>
  <div><button className="secondary" disabled={!ready || busy || !month || !day}>{busy ? t("Sparar…") : t("Spara födelsedatum")}</button></div>
  {message && <p role="status">{t(message)}</p>}
 </form>;
}
