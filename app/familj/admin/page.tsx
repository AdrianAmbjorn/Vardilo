"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  display_name: string;
  role: string;
  user_id: string | null;
};

const roles = [
  ["förälder", "Förälder"],
  ["barn", "Barn"],
  ["familj", "Familj"],
] as const;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function FamilyAdminPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [familyName, setFamilyName] = useState("Familjen");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("familj");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: currentMember } = await supabase
      .from("family_members")
      .select("id, family_id, display_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!currentMember) {
      window.location.href = "/familj";
      return;
    }

    const { data: permission } = await supabase
      .from("family_permissions")
      .select("can_manage_members")
      .eq("family_member_id", currentMember.id)
      .maybeSingle();

    if (!permission?.can_manage_members) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    setAllowed(true);

    const [{ data: family }, { data: familyMembers, error }] = await Promise.all([
      supabase
        .from("families")
        .select("name")
        .eq("id", currentMember.family_id)
        .maybeSingle(),
      supabase
        .from("family_members")
        .select("id, display_name, role, user_id")
        .eq("family_id", currentMember.family_id)
        .order("created_at", { ascending: true }),
    ]);

    if (family?.name) setFamilyName(family.name);
    if (error) {
      setMessage(error.message);
    } else {
      setMembers((familyMembers ?? []) as Member[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("add_family_member_for_current_user", {
      member_name: name,
      member_role: role,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setName("");
    setRole("familj");
    await load();
    setSaving(false);
  }

  if (loading) {
    return <main className="section-shell"><p className="muted">Laddar familjen...</p></main>;
  }

  if (!allowed) {
    return (
      <main className="section-shell">
        <div className="section-header">
          <Link href="/" className="back-link">← Hem</Link>
          <div>
            <p className="eyebrow">FAMILJ</p>
            <h1>Ingen åtkomst</h1>
          </div>
        </div>
        <section className="section-card">
          <div className="section-row">
            <div>
              <strong>Du saknar behörighet att hantera familjemedlemmar.</strong>
              <p>Be en familjeadmin att ge dig rätt behörighet.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="section-shell">
      <div className="section-header">
        <Link href="/" className="back-link">← Hem</Link>
        <div>
          <p className="eyebrow">FAMILJEN</p>
          <h1>{familyName}</h1>
        </div>
      </div>

      <section className="section-card">
        <div className="section-row">
          <div>
            <strong>Familjemedlemmar</strong>
            <p>Här ser du vilka som ingår i familjen och deras roll.</p>
          </div>
          <span>{members.length} medlemmar</span>
        </div>

        {members.map((member) => (
          <div className="section-row" key={member.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="avatar">{initials(member.display_name)}</span>
              <div>
                <strong>{member.display_name}</strong>
                <p>{member.role === "förälder" ? "Förälder" : member.role === "barn" ? "Barn" : member.role === "familj" ? "Familj" : "Admin"}</p>
              </div>
            </div>
            <span className="tag blue">{member.user_id ? "Konto kopplat" : "Familjemedlem"}</span>
          </div>
        ))}

        <div className="section-row" style={{ display: "block" }}>
          <div style={{ marginBottom: 14 }}>
            <strong>Lägg till familjemedlem</strong>
            <p>Lägg först till personen i familjen. Konto och inloggning kopplas på i nästa steg.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 10, alignItems: "end" }}>
            <label className="auth-form" style={{ gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Namn</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Till exempel Malin"
                required
                style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "11px 12px", background: "#fbfcfd", color: "var(--text)" }}
              />
            </label>

            <label className="auth-form" style={{ gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Roll</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "11px 12px", background: "#fbfcfd", color: "var(--text)" }}
              >
                {roles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>

            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Lägger till..." : "Lägg till"}
            </button>
          </form>

          {message && <p className="auth-message" style={{ marginTop: 12 }}>{message}</p>}
        </div>
      </section>
    </main>
  );
}
