"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loginDestination } from "@/lib/login-destination";
import { childLoginEmail, validChildUsername } from "@/lib/child-login";
import "./login.css";
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
  const router = useRouter();
  const supabase = createClient();
  const submitLock = useRef(false);
  const [mode, setMode] = useState<"login" | "signup" | "child">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childUsername, setChildUsername] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function changeMode(next: "login" | "signup" | "child") {
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
    if (mode === "signup") {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setMessage(error.code === "user_already_exists" ? "E-postadressen har redan ett konto. Välj Logga in istället." : error.code === "weak_password" ? "Välj ett starkare lösenord med minst 6 tecken." : "Det gick inte att skapa kontot. Kontrollera uppgifterna och försök igen.");
      } else if (!data.session) {
        setMessage("Kontot är skapat. Kontrollera din e-post för att bekräfta kontot.");
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
        setMessage(error.code === "email_not_confirmed" ? "Bekräfta din e-postadress via länken i mejlet innan du loggar in." : mode === "child" ? "Uppgifterna stämmer inte. Kontrollera din förälders e-post, ditt användarnamn och ditt lösenord." : error.code === "invalid_credentials" ? "E-postadressen eller lösenordet stämmer inte. Försök igen." : "Det gick inte att logga in just nu. Försök igen om en stund.");
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
          <div><strong>VARDILO</strong><span>Mer tid tillsammans.</span></div>
        </div>

        <div className="login-heading">
          <h1>{mode === "signup" ? "Skapa ditt konto" : mode === "child" ? "Hej där!" : "Välkommen tillbaka"}</h1>
          <p>{mode === "signup" ? "Skapa en familj eller gå med via en inbjudan." : mode === "child" ? "Använd din förälders e-post och dina egna inloggningsuppgifter." : "Här samlar ni familjens vardag."}</p>
        </div>

        {mode !== "signup" && <div className="login-modes" role="group" aria-label="Välj inloggning">
          <button type="button" aria-pressed={mode === "login"} disabled={loading} onClick={() => changeMode("login")}>För vuxna</button>
          <button type="button" aria-pressed={mode === "child"} disabled={loading} onClick={() => changeMode("child")}>För barn</button>
        </div>}

        <form onSubmit={handleSubmit} className="auth-form login-form">
          {mode === "signup" && <label htmlFor="login-name">Ditt namn<input id="login-name" value={name} disabled={loading} onChange={event => setName(event.target.value)} placeholder="Förnamn" autoComplete="name" required /></label>}
          <label htmlFor="login-email">{mode === "child" ? "Din förälders e-post" : "E-postadress"}
            <input id="login-email" type="email" value={email} disabled={loading} onChange={event => setEmail(event.target.value)} placeholder="namn@exempel.se" autoComplete="email" autoCapitalize="none" spellCheck={false} required />
          </label>
          {mode === "child" && <label htmlFor="login-username">Ditt användarnamn<input id="login-username" value={childUsername} disabled={loading} onChange={event => setChildUsername(event.target.value)} placeholder="Användarnamn" autoCapitalize="none" autoCorrect="off" autoComplete="username" maxLength={30} required /></label>}
          <div className="login-password-field">
            <label htmlFor="login-password">Lösenord</label>
            <div className="login-password-input">
              <input id="login-password" type={showPassword ? "text" : "password"} value={password} disabled={loading} onChange={event => setPassword(event.target.value)} placeholder={mode === "signup" ? "Välj ett lösenord" : "Ditt lösenord"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 6 : undefined} required />
              <button type="button" className="login-reveal" aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? "Dölj" : "Visa"}</button>
            </div>
            {mode === "signup" && <small>Välj minst 6 tecken.</small>}
          </div>
          {message && <p className="login-message" role="status">{message}</p>}
          <button className="primary auth-submit login-submit" type="submit" disabled={loading}>{loading ? mode === "signup" ? "Skapar konto…" : "Loggar in…" : mode === "signup" ? "Skapa konto" : "Logga in"}</button>
        </form>

        <footer className="login-footer">
          {mode === "child" ? <p>Glömt dina uppgifter? Be din förälder om hjälp.</p> : mode === "signup" ? <p>Har du redan ett konto? <button type="button" disabled={loading} onClick={() => changeMode("login")}>Logga in</button></p> : <p>Ny på Vardilo? <button type="button" disabled={loading} onClick={() => changeMode("signup")}>Skapa konto</button></p>}
        </footer>
      </section>
    </main>
  );
}
