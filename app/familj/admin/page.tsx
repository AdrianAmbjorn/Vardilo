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

  if (loading) return <main className="p-8">Laddar...</main>;

  return (
    <main className="min-h-screen bg-white p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-red-600">Familj</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{familyName || "Familjeinställningar"}</h1>
          <p className="mt-2 text-slate-500">Hantera vilka som hör till familjen och deras relation.</p>
        </div>

        {canManageMembers && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Lägg till familjemedlem</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_220px_auto] md:items-end">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Namn</span>
                <input
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  placeholder="T.ex. Mormor"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-red-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Kategori</span>
                <select
                  value={memberRole}
                  onChange={(event) => setMemberRole(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                >
                  <option value="förälder">Förälder</option>
                  <option value="barn">Barn</option>
                  <option value="familj">Familj</option>
                </select>
              </label>
              {memberRole === "familj" ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Relation</span>
                  <select
                    value={familyRelationship}
                    onChange={(event) => setFamilyRelationship(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
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
                className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Lägger till..." : "Lägg till"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Relationen används för att göra familjen mer personlig. Den kan ändras senare.</p>
          </section>
        )}

        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Familjemedlemmar</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const relationship = familyRelationships.find(([value]) => value === member.family_role)?.[1];
              return (
                <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-medium">{member.display_name}</p>
                    <p className="text-sm text-slate-500">
                      {member.role === "familj" ? relationship ?? "Familj" : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      {member.user_id ? " · Konto kopplat" : " · Familjemedlem"}
                    </p>
                  </div>
                  {canManageMembers && (
                    <button
                      type="button"
                      onClick={() => removeMember(member)}
                      disabled={removingId === member.id}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {removingId === member.id ? "Tar bort..." : "Ta bort"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
