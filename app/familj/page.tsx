"use client";

import { FormEvent, useEffect, useState } from "react";
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
  const supabase = createClient();
  const [name, setName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: member } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!active) return;

      if (member) {
        router.replace("/");
        return;
      }

      const displayName = (user.user_metadata?.display_name as string | undefined) ?? "";
      setName(displayName);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("create_family_for_current_user", {
      family_name: familyName,
      member_name: name,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    router.replace("/");
    router.refresh();
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

          {message && <p className="auth-message">{message}</p>}

          <button className="primary auth-submit" type="submit" disabled={saving}>
            {saving ? "Skapar familjen..." : "Skapa familj"}
          </button>
        </form>
      </section>
    </main>
  );
}
