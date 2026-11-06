"use client";
import { useLanguage } from "../components/language-provider";
import { invitationContinuation } from "@/lib/login-destination";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "../login/login.css";

export default function PasswordPage() {
 const { t, language, locale } = useLanguage();

 const supabase = useMemo(() => createClient(), []);
 const [continuation, setContinuation] = useState("");
 const [reset, setReset] = useState(false);
 const [ready, setReady] = useState(false);
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [confirm, setConfirm] = useState("");
 const [busy, setBusy] = useState(false);
 const [done, setDone] = useState(false);
 const [message, setMessage] = useState("");
 const [waitUntil, setWaitUntil] = useState(0);
 const lock = useRef(false);
 useEffect(() => {
  let active = true;
  const params = new URLSearchParams(window.location.search);
  setContinuation(invitationContinuation(window.location.search));
  if (params.has("error")) setMessage("Länken är ogiltig eller har gått ut. Begär en ny nedan.");
  if (!params.has("nytt")) { setReady(true); return; }
  void supabase.auth.getUser().then(({ data, error }) => {
   if (!active) return;
   if (error || !data.user) setMessage("Öppna länken från återställningsmejlet. Du kan begära en ny här.");
   else setReset(true);
   setReady(true);
  }).catch(() => { if (active) { setMessage("Kunde inte kontrollera länken. Försök igen."); setReady(true); } });
  return () => { active = false; };
 }, [supabase]);
 async function submit(event: React.FormEvent) {
  event.preventDefault(); if (lock.current || !ready || done) return;
  if (reset && (password.length < 10 || password.length > 128 || password !== confirm)) { setMessage("Ange samma lösenord i båda fälten, med 10–128 tecken."); return; }
  if (!reset && Date.now() < waitUntil) { setMessage("Vänta en minut innan du begär ett nytt mejl."); return; }
  lock.current = true; setBusy(true); setMessage("");
  try {
   if (reset) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setPassword(""); setConfirm(""); setDone(true); setMessage("Ditt lösenord är ändrat.");
   } else {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?flow=recovery${invitationContinuation(window.location.search, "&")}` });
    if (error) throw error;
    setWaitUntil(Date.now() + 60_000);
    setMessage("Om adressen har ett konto får du ett mejl med en återställningslänk. Kontrollera även skräpposten och öppna länken på den här enheten.");
   }
  } catch { setMessage(reset ? "Kunde inte ändra lösenordet. Länken kan ha gått ut; begär då en ny." : "Kunde inte begära mejlet just nu. Försök igen om en stund."); }
  finally { lock.current = false; setBusy(false); }
 }
 return <main className="auth-shell login-page"><section className="auth-card login-card"><div className="login-heading"><h1>{reset ? t("Välj nytt lösenord") : t("Glömt lösenord?")}</h1><p>{reset ? t("Välj ett lösenord som du inte använder någon annanstans.") : t("Ange din e-postadress så hjälper vi dig tillbaka. Barnets lösenord ändras av en förälder i familjeinställningarna.")}</p></div>
 {!done && <form className="auth-form login-form" onSubmit={submit}>{reset ? <><label>{t("Nytt lösenord")}<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label><label>{t("Upprepa lösenordet")}<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={busy} value={confirm} onChange={event => setConfirm(event.target.value)} /></label></> : <label>{t("E-postadress")}<input type="email" autoComplete="email" autoCapitalize="none" required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /></label>}<button className="primary" disabled={busy || !ready}>{busy ? t("Vänta…") : reset ? t("Spara nytt lösenord") : t("Skicka återställningslänk")}</button></form>}
 {message && <p className="login-message" role="status" style={{marginTop:16}}>{t(message)}</p>}<footer className="login-footer"><Link href={`/login${continuation}`}>{t("Till inloggningen")}</Link></footer></section></main>;
}
