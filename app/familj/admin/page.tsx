"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FamilyMember = {
  id: string;
  display_name: string;
  role: string;
  family_role: string | null;
  user_id: string | null;
};

const familyRelationships = [
  ["mamma", "Mamma"],
  ["pappa", "Pappa"],
  ["bonusmamma", "Bonusmamma"],
  ["bonuspappa", "Bonuspappa"],
  ["mormor", "Mormor"],
  ["morfar", "Morfar"],
  ["farmor", "Farmor"],
  ["farfar", "Farfar"],
  ["moster", "Moster"],
  ["morbror", "Morbror"],
  ["faster", "Faster"],
  ["farbror", "Farbror"],
  ["kusin", "Kusin"],
  ["annan_nara_familj", "Annan nära familj"],
] as const;

export default function FamilyAdminPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [familyName, setFamilyName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("familj");
  const [familyRelationship, setFamilyRelationship] = useState("mormor");
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadFamily() {
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return;

    const { data: currentMember } = await supabase
      .from("family_members")
      .select("id, family_id")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (!currentMember) return;

    const [{ data: family }, { data: permissions }, { data: familyMembers, error: membersError }] =
      await Promise.all([
        supabase.from("families").select("name").eq("id", currentMember.family_id).single(),
        supabase.from("family_permissions").select("can_manage_members").eq("family_member_id", currentMember.id).single(),
        supabase
          .from("family_members")
          .select("id, display_name, role, family_role, user_id")
          .eq("family_id", currentMember.family_id)
          .order("created_at"),
      ]);

    if (membersError) {
      setError(membersError.message);
      return;
    }

    setFamilyName(family?.name ?? "");
    setCanManageMembers(Boolean(permissions?.can_manage_members));
    setMembers((familyMembers ?? []) as FamilyMember[]);
  }

  useEffect(() => {
    loadFamily().finally(() => setLoading(false));
  }, []);

  async function addMember() {
    if (!memberName.trim()) return;
    setSaving(true);
    setError("");

    const { error: rpcError } = await supabase.rpc("add_family_member_for_current_user", {
      member_name: memberName.trim(),
      member_role: memberRole,
      member_family_role: memberRole === "familj" ? familyRelationship : null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMemberName("");
      await loadFamily();
    }

    setSaving(false);
  }

  async function removeMember(member: FamilyMember) {
    if (!window.confirm(`Ta bort ${member.display_name} från familjen?`)) return;

    setRemovingId(member.id);
    setError("");
    const { error: rpcError } = await supabase.rpc("delete_family_member_for_current_user", {
      target_member_id: member.id,
    });

    if (rpcError) setError(rpcError.message);
    else await loadFamily();
    setRemovingId(null);
  }

  if (loading) {
    return <main className="section-shell">Laddar...</main>;
  }

  return (
    <main className="section-shell">
      <div className="section-header">
        <a href="/" className="back-link">← Hem</a>
        <div>
          <p className="eyebrow">FAMILJ</p>
          <h1>{familyName || "Familjeinställningar"}</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Hantera vilka som hör till familjen och deras relation.
          </p>
        </div>
      </div>

      {error && <p className="family-admin-error" style={{ maxWidth: 1050, margin: "0 auto 16px" }}>{error}</p>}

      <section className="section-card">
        {canManageMembers && (
          <div className="family-admin-form">
            <div className="card-heading">
              <h3>Lägg till familjemedlem</h3>
            </div>

            <div
              className="family-admin-fields"
              style={{ gridTemplateColumns: "minmax(220px, 1fr) 170px 220px auto" }}
            >
              <label className="family-admin-field">
                <span>Namn</span>
                <input
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  placeholder="T.ex. Mormor"
                />
              </label>

              <label className="family-admin-field">
                <span>Kategori</span>
                <select
                  value={memberRole}
                  onChange={(event) => setMemberRole(event.target.value)}
                >
                  <option value="förälder">Förälder</option>
                  <option value="barn">Barn</option>
                  <option value="familj">Familj</option>
                </select>
              </label>

              {memberRole === "familj" ? (
                <label className="family-admin-field">
                  <span>Relation</span>
                  <select
                    value={familyRelationship}
                    onChange={(event) => setFamilyRelationship(event.target.value)}
                  >
                    {familyRelationships.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              ) : <div />}

              <button
                type="button"
                onClick={addMember}
                disabled={saving || !memberName.trim()}
                className="primary"
                style={{ border: 0, cursor: saving || !memberName.trim() ? "not-allowed" : "pointer", opacity: saving || !memberName.trim() ? 0.55 : 1 }}
              >
                {saving ? "Lägger till..." : "Lägg till"}
              </button>
            </div>

            <p className="family-admin-help">
              Relationen gör familjen mer personlig och kan ändras senare.
            </p>
          </div>
        )}

        <div className="family-admin-list">
          <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
            <h3>Familjemedlemmar</h3>
          </div>

          {members.map((member) => {
            const relationship = familyRelationships.find(([value]) => value === member.family_role)?.[1];
            const roleLabel = member.role === "familj"
              ? relationship ?? "Familj"
              : member.role.charAt(0).toUpperCase() + member.role.slice(1);

            return (
              <div key={member.id} className="family-admin-member">
                <div>
                  <div className="family-admin-member-name">{member.display_name}</div>
                  <div className="family-admin-member-meta">
                    {roleLabel}{member.user_id ? " · Konto kopplat" : " · Familjemedlem"}
                  </div>
                </div>

                {canManageMembers && (
                  <button
                    type="button"
                    onClick={() => removeMember(member)}
                    disabled={removingId === member.id}
                    className="family-admin-remove"
                  >
                    {removingId === member.id ? "Tar bort..." : "Ta bort"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
