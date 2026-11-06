"use client";
import { useLanguage, LanguagePicker } from "../components/language-provider";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmationRedirect, emailRequestError } from "@/lib/auth-messages";
import { loginDestination, invitationContinuation } from "@/lib/login-destination";
import { childLoginEmail, validChildUsername } from "@/lib/child-login";
import "./login.css";
import { birthdayParts } from "@/lib/birthday-input";
import { createClient } from "@/lib/supabase/client";

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24">
      <path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-8.1Z" fill="currentColor" />
      <path d="M9.1 20v-5.2h5.8V20" fill="white" />
    </svg>
  );
}

export default function LoginPage() {
 const { t, language, locale } = useLanguage();

  const router = useRouter();
  const supabase = createClient();
  const submitLock = useRef(false);
  const [mode, setMode] = useState<"login" | "signup" | "child" | "confirm">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childUsername, setChildUsername] = useState("");
  const [name, setName] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(0);
  const [continuation, setContinuation] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setContinuation(invitationContinuation(window.location.search));
    if (new URLSearchParams(window.location.search).has("error")) { setMode("login"); setMessage("Länken kunde inte slutföra inloggningen. Om du just bekräftade din e-post kan du logga in här. Behöver du en ny bekräftelselänk finns valet nedan."); }
  }, []);
  useEffect(() => {
    if (mode !== "confirm") return;
    const update = () => setClock(Date.now());
    update(); const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [mode]);
  const resendWait = Math.max(0, Math.ceil((resendAt - clock) / 1000));

  function changeMode(next: "login" | "signup" | "child" | "confirm") {
    setMode(next); setPassword(""); setShowPassword(false); setMessage("");
  }


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setLoading(true);
    setMessage("");

    try {
    const destination = loginDestination(window.location.search);
    if (mode === "confirm") {
      if (Date.now() < resendAt) return;
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: confirmationRedirect(window.location.origin, destination) } });
      if (error) { setMessage(emailRequestError(error.code)); if (error.status === 429) { setResendAt(Date.now() + 60_000); setClock(Date.now()); } }
      else { setResendAt(Date.now() + 60_000); setClock(Date.now()); setMessage("Ett nytt bekräftelsemejl har begärts. Kontrollera inkorgen och skräpposten. Om kontot redan är bekräftat kan du logga in direkt."); }
    } else if (mode === "signup") {
      if (!adultConfirmed) { setMessage("Bekräfta att du är minst 18 år. Barnkonton skapas av en vårdnadshavare."); return; }
      if (!name.trim()) { setMessage("Fyll i ditt namn."); return; }
      if (password.length < 10 || password.length > 128) { setMessage("Välj ett lösenord på 10–128 tecken."); return; }
      let birthday;
      try { birthday = birthdayParts(birthMonth, birthDay); }
      catch { setMessage("Välj en giltig dag och månad, eller lämna båda tomma."); return; }
      const redirectTo = confirmationRedirect(window.location.origin, destination);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name.trim(), ...birthday, language, adult_confirmed: true },
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setMessage(error.code === "user_already_exists" ? "E-postadressen har redan ett konto. Välj Logga in istället." : error.code === "weak_password" ? "Välj ett starkare lösenord med minst 10 tecken." : emailRequestError(error.code));
      } else if (!data.session) {
        setMode("confirm"); setPassword(""); setResendAt(Date.now() + 60_000); setClock(Date.now());
        setMessage("Kontrollera din e-post för att bekräfta kontot. Titta även i skräpposten. Du kan begära ett nytt mejl här om det inte kommer fram.");
      } else {
        router.push(destination);
        router.refresh();
      }
    } else {
      if (mode === "child" && !validChildUsername(childUsername)) { setMessage("Kontrollera barnets användarnamn."); return; }
      const { error } = await supabase.auth.signInWithPassword({
        email: mode === "child" ? await childLoginEmail(email, childUsername) : email.trim(),
        password,
      });

      if (error) {
        if (mode !== "child" && error.code === "email_not_confirmed") { setMode("confirm"); setPassword(""); }
        setMessage(mode === "child" ? "Uppgifterna stämmer inte. Kontrollera din förälders e-post, ditt användarnamn och ditt lösenord. Be din förälder om hjälp om det inte fungerar." : error.code === "email_not_confirmed" ? "Bekräfta din e-postadress via länken i mejlet innan du loggar in." : error.code === "invalid_credentials" ? "E-postadressen eller lösenordet stämmer inte. Försök igen." : "Det gick inte att logga in just nu. Försök igen om en stund.");
      } else {
        router.push(destination);
        router.refresh();
      }
    }

    } catch {
      setMessage("Kunde inte ansluta. Försök igen – dina uppgifter finns kvar.");
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell login-page">
      <section className="auth-card login-card">
        <div className="login-brand" aria-label="Vardilo">
          <span className="login-house"><HouseIcon /></span>
          <div><strong>VARDILO</strong><span>{t("Mer tid tillsammans.")}</span></div>
        </div>

        <LanguagePicker />
        <div className="login-heading">
          <h1>{mode === "confirm" ? t("Saknar du mejlet?") : mode === "signup" ? t("Skapa ditt konto") : mode === "child" ? t("Hej där!") : t("Välkommen tillbaka")}</h1>
          <p>{mode === "confirm" ? t("Ange e-postadressen du använde när du skapade kontot, så kan du begära en ny bekräftelselänk.") : mode === "signup" ? t("Skapa en familj eller gå med via en inbjudan.") : mode === "child" ? t("Använd din förälders e-post och dina egna inloggningsuppgifter.") : t("Här samlar ni familjens vardag.")}</p>
        </div>

        {(mode === "login" || mode === "child") && <div className="login-modes" role="group" aria-label={t("Välj inloggning")}>
          <button type="button" aria-pressed={mode === "login"} disabled={loading} onClick={() => changeMode("login")}>{t("För vuxna")}</button>
          <button type="button" aria-pressed={mode === "child"} disabled={loading} onClick={() => changeMode("child")}>{t("För barn")}</button>
        </div>}

        <form onSubmit={handleSubmit} className="auth-form login-form">
          {mode === "signup" && <label htmlFor="login-name">{t("Ditt namn")}<input id="login-name" value={name} disabled={loading} onChange={event => setName(event.target.value)} placeholder={t("Förnamn")} autoComplete="name" required /></label>}
          {mode === "signup" && <fieldset style={{border:0,padding:0,margin:0}}><legend>{language === "en" ? "Birthday (optional)" : "Födelsedag (valfritt)"}</legend><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label>{language === "en" ? "Month" : "Månad"}<select value={birthMonth} disabled={loading} onChange={event=>setBirthMonth(event.target.value)}><option value="">—</option>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Intl.DateTimeFormat(locale,{month:"long"}).format(new Date(2000,i,1))}</option>)}</select></label><label>{language === "en" ? "Day" : "Dag"}<select value={birthDay} disabled={loading} onChange={event=>setBirthDay(event.target.value)}><option value="">—</option>{Array.from({length:31},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label></div><small>{language === "en" ? "No birth year needed. Used for family birthday reminders." : "Inget födelseår behövs. Används för familjens födelsedagspåminnelser."}</small></fieldset>}
          <label htmlFor="login-email">{mode === "child" ? t("Din förälders e-post") : t("E-postadress")}
            <input id="login-email" type="email" value={email} disabled={loading} onChange={event => setEmail(event.target.value)} placeholder="namn@exempel.se" autoComplete="email" autoCapitalize="none" spellCheck={false} required />
          </label>
          {mode === "child" && <label htmlFor="login-username">{t("Ditt användarnamn")}<input id="login-username" value={childUsername} disabled={loading} onChange={event => setChildUsername(event.target.value)} placeholder={t("Användarnamn")} autoCapitalize="none" autoCorrect="off" autoComplete="username" maxLength={30} required /></label>}
          {mode !== "confirm" && <div className="login-password-field">
            <label htmlFor="login-password">{t("Lösenord")}</label>
            <div className="login-password-input">
              <input id="login-password" type={showPassword ? "text" : "password"} value={password} disabled={loading} onChange={event => setPassword(event.target.value)} placeholder={mode === "signup" ? t("Välj ett lösenord") : t("Ditt lösenord")} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 10 : undefined} required />
              <button type="button" className="login-reveal" aria-label={showPassword ? t("Dölj lösenord") : t("Visa lösenord")} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? t("Dölj") : t("Visa")}</button>
            </div>
            {mode === "signup" && <small>{t("Välj minst 10 tecken.")}</small>}
          </div>}
          {mode === "signup" && <label style={{display:"flex",alignItems:"flex-start",gap:10}}><input type="checkbox" required checked={adultConfirmed} disabled={loading} style={{width:20,minHeight:20,marginTop:2}} onChange={event=>setAdultConfirmed(event.target.checked)} /><span>{language === "en" ? "I am at least 18 and am creating an adult account. Children join through a parent or guardian." : "Jag är minst 18 år och skapar ett vuxenkonto. Barn ansluts av en vårdnadshavare."}</span></label>}
          {message && <p className="login-message" role="status">{t(message)}</p>}
          <button className="primary auth-submit login-submit" type="submit" disabled={loading || (mode === "confirm" && resendWait > 0)}>{loading ? mode === "confirm" ? t("Begär mejl…") : mode === "signup" ? t("Skapar konto…") : t("Loggar in…") : mode === "confirm" ? resendWait > 0 ? language === "en" ? `Request another email in ${resendWait} s` : `Nytt mejl kan begäras om ${resendWait} s` : t("Skicka nytt bekräftelsemejl") : mode === "signup" ? t("Skapa konto") : t("Logga in")}</button>
        </form>

        <footer className="login-footer">
          <p><Link href="/integritet">Integritet</Link> · <Link href="/villkor">Testvillkor</Link> · <Link href="/barn-och-integritet">Barnkonton</Link></p>
          {mode === "login" && <p><Link href={`/losenord${continuation}`}>{t("Glömt lösenord?")}</Link></p>}
          {mode === "confirm" ? <p>{t("Har du bekräftat adressen?")} <button type="button" disabled={loading} onClick={() => changeMode("login")}>{t("Till inloggningen")}</button></p> : mode === "child" ? <p>{t("Glömt dina uppgifter? Be din förälder om hjälp.")}</p> : mode === "signup" ? <p>{t("Har du redan ett konto?")} <button type="button" disabled={loading} onClick={() => changeMode("login")}>{t("Logga in")}</button></p> : <p>{t("Ny på Vardilo?")} <button type="button" disabled={loading} onClick={() => changeMode("signup")}>{t("Skapa konto")}</button></p>}
          {mode === "login" && <p><button type="button" disabled={loading} onClick={() => changeMode("confirm")}>{t("Jag har inte fått mitt bekräftelsemejl")}</button></p>}
        </footer>
      </section>
    </main>
  );
}
