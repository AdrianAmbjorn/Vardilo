"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Invitations from "./invitations";
import ChildLogins from "./child-logins";
import { createClient } from "@/lib/supabase/client";

type FamilyMember = {
  id: string;
  display_name: string;
  role: string;
  family_role: string | null;
  user_id: string | null;
  color: string;
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

const colors = [
  ["red", "Röd"],
  ["yellow", "Gul"],
  ["blue", "Blå"],
  ["green", "Grön"],
  ["purple", "Lila"],
  ["orange", "Orange"],
  ["teal", "Turkos"],
  ["pink", "Rosa"],
] as const;

const colorHex: Record<string, string> = {
  red: "#c62828",
  yellow: "#f2c94c",
  blue: "#2f6f9f",
  green: "#3f7d4a",
  purple: "#7652a8",
  orange: "#d97828",
  teal: "#2f8f8f",
  pink: "#c45a83",
};

export default function FamilyAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const actionLock = useRef(false);
  const [currentRole,setCurrentRole]=useState("");
  const [savingRoleId,setSavingRoleId]=useState<string|null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [familyName, setFamilyName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("familj");
  const [familyRelationship, setFamilyRelationship] = useState("mormor");
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingColorId, setSavingColorId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadFamily() {
    setError("");
    try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError && authError.name !== "AuthSessionMissingError") throw authError;
    const user = authData.user;
    if (!user) { setCurrentRole("");setCanManageMembers(false);setMembers([]);setError("Logga in för att hantera familjen."); return; }

    const { data: currentMember, error: memberError } = await supabase
      .from("family_members")
      .select("id, family_id, role")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!currentMember) { setCurrentRole("");setCanManageMembers(false);setMembers([]);setError("Kunde inte hitta din familj."); return; }

    const [{ data: family, error: familyError }, { data: familyMembers, error: membersError }] =
      await Promise.all([
        supabase.from("families").select("name").eq("id", currentMember.family_id).single(),
        supabase
          .from("family_members")
          .select("id, display_name, role, family_role, user_id, color")
          .eq("family_id", currentMember.family_id)
          .order("created_at"),
      ]);

    if (familyError || membersError) throw familyError || membersError;

    setFamilyName(family?.name ?? "");
    setCurrentRole(currentMember.role);
    setCanManageMembers(currentMember.role === "admin");
    setMembers((familyMembers ?? []) as FamilyMember[]);
    } catch { setError("Kunde inte läsa familjen. Försök igen."); }
  }

  useEffect(() => {
    loadFamily().finally(() => setLoading(false));
  }, []);

  async function addMember() {
    if (!memberName.trim()) return;
    if (actionLock.current || !canManageMembers) return;
    actionLock.current = true;
    setSaving(true);
    setError("");

    try {
    const { error: rpcError } = await supabase.rpc("add_family_member_for_current_user", {
      member_name: memberName.trim(),
      member_role: memberRole,
      member_family_role: memberRole !== "barn" ? familyRelationship : null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMemberName("");
      await loadFamily();
    }

} catch { setError("Kunde inte spara ändringen. Kontrollera familjen och försök igen."); }
    finally { actionLock.current = false; setSaving(false); }

  }

  async function changeColor(memberId: string, color: string) {
    if (actionLock.current || !canManageMembers) return;
    actionLock.current = true;
    setSavingColorId(memberId);
    setError("");
    try {
    const { error: rpcError } = await supabase.rpc("set_family_member_color_for_current_user", {
      target_member_id: memberId,
      member_color: color,
    });
    if (rpcError) setError(rpcError.message);
    else setMembers((current) => current.map((member) => member.id === memberId ? { ...member, color } : member));
} catch { setError("Kunde inte spara ändringen. Kontrollera familjen och försök igen."); }
    finally { actionLock.current = false; setSavingColorId(null); }

  }

  async function removeMember(member: FamilyMember) {
    if (!window.confirm(`Ta bort ${member.display_name} från familjen?`)) return;

    if (actionLock.current || !canManageMembers) return;
    actionLock.current = true;
    setRemovingId(member.id);
    setError("");
    try {
    const { error: rpcError } = await supabase.rpc("delete_family_member_for_current_user", {
      target_member_id: member.id,
    });

    if (rpcError) setError(rpcError.message);
    else await loadFamily();
} catch { setError("Kunde inte spara ändringen. Kontrollera familjen och försök igen."); }
    finally { actionLock.current = false; setRemovingId(null); }

  }

  async function changeRole(member: FamilyMember, role: string, relationship = member.family_role) {
    if(actionLock.current||!canManageMembers)return;
    if(role!==member.role&&!window.confirm(`Ändra rollen för ${member.display_name} till ${role === "familj" ? "Familjemedlem" : role}?`))return;
    actionLock.current=true;setSavingRoleId(member.id);setError("");
    try{const result=await supabase.rpc("set_family_member_role",{p_member_id:member.id,p_role:role,p_family_role:relationship});if(result.error)throw result.error;await loadFamily()}
    catch(error){setError(typeof error==="object"&&error&&"message" in error?String(error.message):"Kunde inte ändra rollen.")}
    finally{actionLock.current=false;setSavingRoleId(null)}
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
            Hantera vilka som hör till familjen, deras relation och färg.
          </p>
        </div>
      </div>

      {error && <div className="family-admin-error" role="alert" style={{ maxWidth: 1050, margin: "0 auto 16px" }}><p>{error}</p><button type="button" className="secondary" disabled={saving || savingRoleId!==null || savingColorId!==null || removingId!==null} onClick={()=>void loadFamily()}>Hämta familjen igen</button></div>}

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
                  <option value="admin">Admin</option>
                  <option value="förälder">Förälder</option>
                  <option value="barn">Barn</option>
                  <option value="familj">Familj</option>
                </select>
              </label>

              {memberRole !== "barn" ? (
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
              Relationen gör familjen mer personlig. Färgen används genom hela Vardilo.
            </p>
          </div>
        )}

        {canManageMembers && <Invitations members={members} onChanged={loadFamily} />}
        {["admin","förälder"].includes(currentRole) && <ChildLogins members={members} onChanged={loadFamily} />}
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
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 18, height: 18, borderRadius: "50%", background: colorHex[member.color] ?? colorHex.blue, display: "inline-block", flex: "0 0 auto", border: "2px solid #ffffff", boxShadow: "0 0 0 1px #dbe3ea" }}
                  />
                  <div>
                    <div className="family-admin-member-name">{member.display_name}</div>
                    <div className="family-admin-member-meta">
                      {member.role === "admin" ? "Admin" : member.role === "familj" ? "Familjemedlem" : roleLabel}{relationship ? ` · ${relationship}` : ""}{member.user_id ? " · Konto kopplat" : " · Familjemedlem"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {canManageMembers && <label className="family-admin-field" style={{margin:0}}><span>Roll</span><select aria-label={`Roll för ${member.display_name}`} value={member.role} disabled={savingRoleId!==null} onChange={event=>void changeRole(member,event.target.value)}><option value="admin">Admin</option><option value="förälder">Förälder</option><option value="barn">Barn</option><option value="familj">Familjemedlem</option></select></label>}
                  {canManageMembers && member.role!=="barn" && <label className="family-admin-field" style={{margin:0}}><span>Relation</span><select aria-label={`Relation för ${member.display_name}`} value={member.family_role??""} disabled={savingRoleId!==null} onChange={event=>void changeRole(member,member.role,event.target.value)}><option value="">Ej angiven</option>{familyRelationships.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
                  <label className="family-admin-field" style={{ margin: 0 }}>
                    <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Färg</span>
                    <select value={member.color} onChange={(event) => changeColor(member.id, event.target.value)} disabled={savingColorId === member.id} aria-label={`Färg för ${member.display_name}`}>
                      {colors.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
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
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
