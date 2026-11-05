"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24">
      <path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-8.1Z" fill="currentColor" />
      <path d="M9.1 20v-5.2h5.8V20" fill="white" />
    </svg>
  );
}

export default function FamilySetupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const submitLock = useRef(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError && authError.name !== "AuthSessionMissingError") throw authError;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!active) return;

      if (member) {
        router.replace("/");
        return;
      }

      const displayName = (user.user_metadata?.display_name as string | undefined) ?? "";
      setName(displayName);
      } catch {
        if (active) { setLoadFailed(true); setMessage("Kunde inte kontrollera din familj. Ladda om och försök igen."); }
      } finally { if (active) setLoading(false); }
    }

    load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || loadFailed) return;
    if (!name.trim() || !familyName.trim()) { setMessage("Fyll i ditt namn och familjens namn."); return; }
    submitLock.current = true;
    setSaving(true);
    try {
    setMessage("");

    const { error } = await supabase.rpc("create_family_for_current_user", {
      family_name: familyName.trim(),
      member_name: name.trim(),
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    router.replace("/");
    router.refresh();
    } catch { setMessage("Kunde inte skapa familjen. Försök igen."); }
    finally { submitLock.current = false; setSaving(false); }
  }

  if (loading) {
    return <main className="auth-shell"><p className="muted">Förbereder din familj...</p></main>;
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
          <p className="eyebrow">FAMILJEN</p>
          <h1>Skapa familjen</h1>
          <p className="muted">Börja med familjens namn och ditt namn. Sedan bygger vi familjen tillsammans.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Familjens namn
            <input
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="Till exempel Familjen Andersson"
              required
              autoFocus
            />
          </label>

          <label>
            Ditt namn
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ditt namn"
              required
            />
          </label>

          {message && <p role="alert" className="auth-message">{message}</p>}
          {loadFailed && <button type="button" className="secondary" onClick={() => window.location.reload()}>Försök igen</button>}

          <button className="primary auth-submit" type="submit" disabled={saving || loadFailed}>
            {saving ? "Skapar familjen..." : "Skapa familj"}
          </button>
        </form>
      </section>
    </main>
  );
}
