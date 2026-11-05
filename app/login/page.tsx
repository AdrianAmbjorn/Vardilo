"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { childLoginEmail, validChildUsername } from "@/lib/child-login";
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setLoading(true);
    setMessage("");

    try {
    if (mode === "signup") {
      const redirectTo = `${window.location.origin}/auth/callback?next=/familj`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setMessage(error.message);
      } else if (!data.session) {
        setMessage("Kontot är skapat. Kontrollera din e-post för att bekräfta kontot.");
      } else {
        router.push("/familj");
        router.refresh();
      }
    } else {
      if (mode === "child" && !validChildUsername(childUsername)) { setMessage("Kontrollera barnets användarnamn."); return; }
      const { error } = await supabase.auth.signInWithPassword({
        email: mode === "child" ? await childLoginEmail(email, childUsername) : email.trim(),
        password,
      });

      if (error) {
        setMessage(mode === "child" ? "Kunde inte logga in. Kontrollera förälderns e-post, barnets användarnamn och lösenord." : error.message);
      } else {
        router.push("/familj");
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
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark house-brand-mark" aria-label="Vardilo"><HouseIcon /></div>
          <div>
            <strong>VARDILO</strong>
            <span>Family life, together.</span>
          </div>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">{mode === "child" ? "BARNENS VARDILO" : mode === "login" ? "VÄLKOMMEN TILLBAKA" : "NYTT KONTO"}</p>
          <h1>{mode === "child" ? "Barninloggning" : mode === "login" ? "Logga in" : "Skapa ditt Vardilo-konto"}</h1>
          <p className="muted">
            {mode === "child" ? "Använd förälderns e-post och din egen inloggning. Be din förälder om hjälp om du glömt lösenordet." : mode === "login"
              ? "Logga in för att komma till familjens Vardilo."
              : "Börja med ditt eget konto. Sedan skapar du familjen."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <label>
              Namn
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ditt namn"
                required
              />
            </label>
          )}

          <label>
            {mode === "child" ? "Förälderns e-post" : "E-post"}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="du@exempel.se"
              autoComplete="email"
              required
            />
          </label>

          {mode === "child" && <label>Ditt användarnamn<input value={childUsername} onChange={event => setChildUsername(event.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" maxLength={30} required /></label>}

          <label>
            Lösenord
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minst 6 tecken"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>

          {message && <p className="auth-message" role="status">{message}</p>}

          <button className="primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Arbetar..." : mode !== "signup" ? "Logga in" : "Skapa konto"}
          </button>
        </form>

        <button
          className="auth-switch"
          disabled={loading}
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setPassword("");
            setMessage("");
          }}
        >
          {mode === "signup" ? "Har du redan ett konto? Logga in" : "Har du inget vuxenkonto? Skapa ett"}
        </button>
        <button className="auth-switch" type="button" disabled={loading} onClick={() => { setMode(mode === "child" ? "login" : "child"); setPassword(""); setMessage(""); }}>{mode === "child" ? "Till vuxeninloggning" : "Barninloggning"}</button>
      </section>
    </main>
  );
}
