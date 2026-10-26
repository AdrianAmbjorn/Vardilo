"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
        },
      });

      if (error) {
        setMessage(error.message);
      } else if (!data.session) {
        setMessage("Kontot är skapat. Kontrollera din e-post för att bekräfta kontot.");
      } else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>VARDILO</strong>
            <span>Family life, together.</span>
          </div>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">{mode === "login" ? "VÄLKOMMEN TILLBAKA" : "NYTT KONTO"}</p>
          <h1>{mode === "login" ? "Logga in" : "Skapa ditt Vardilo-konto"}</h1>
          <p className="muted">
            {mode === "login"
              ? "Logga in för att komma till familjens Vardilo."
              : "Börja med ditt eget konto. Familjen skapar vi i nästa steg."}
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
            E-post
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="du@exempel.se"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Lösenord
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minst 6 tecken"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>

          {message && <p className="auth-message">{message}</p>}

          <button className="primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Arbetar..." : mode === "login" ? "Logga in" : "Skapa konto"}
          </button>
        </form>

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
        >
          {mode === "login" ? "Har du inget konto? Skapa ett" : "Har du redan ett konto? Logga in"}
        </button>
      </section>
    </main>
  );
}
