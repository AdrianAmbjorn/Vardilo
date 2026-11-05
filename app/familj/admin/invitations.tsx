"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { invitationStatus, invitationStatusLabels } from "@/lib/invitation-status";

type Member = { id: string; display_name: string; role: string; user_id: string | null };
type Invitation = { id: string; member_id: string; email: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };
type IssuedLink = { id: string; memberId: string; role: string; url: string };
const dateLabel = (date: string) => new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));

export default function Invitations({ members, onChanged }: { members: Member[]; onChanged: () => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [memberId, setMemberId] = useState("");
  const [email, setEmail] = useState("");
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const requestId = useRef(0);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const previousMembershipStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const result = await supabase.from("family_invitations")
        .select("id,member_id,email,expires_at,accepted_at,revoked_at").order("created_at", { ascending: false });
      if (request !== requestId.current) return;
      if (result.error) throw result.error;
      const rows: Invitation[] = result.data ?? [];
      setInvitations(rows);
      setLoadError("");
      setIssued(current => current && rows.some(row => row.id === current.id && invitationStatus(row) === "pending") ? current : null);
      const accepted = rows.filter(row => row.accepted_at).map(row => row.id).sort().join(",");
      const previous = previousMembershipStatus.current;
      previousMembershipStatus.current = accepted;
      if (previous !== null && previous !== accepted) await changed.current();
      return true;
    } catch {
      if (request === requestId.current) setLoadError("Kunde inte läsa inbjudningarna. Försök att uppdatera igen.");
      return false;
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible" && !lock.current) void load(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      requestId.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  useEffect(() => {
    setIssued(current => {
      if (!current) return null;
      const member = members.find(member => member.id === current.memberId);
      return member && !member.user_id && member.role === current.role ? current : null;
    });
  }, [members]);

  async function issue(targetId: string, address: string) {
    if (lock.current || !targetId || !address.trim()) return;
    lock.current = true; setBusy(true); setError(""); setNotice(""); setIssued(null);
    try {
      const { data, error } = await supabase.rpc("create_family_invitation", { p_member_id: targetId, p_email: address.trim() });
      if (error) throw error;
      const member = members.find(member => member.id === targetId);
      await load();
      if (member) setIssued({ id: data.id, memberId: targetId, role: member.role, url: `${window.location.origin}/inbjudan?kod=${encodeURIComponent(data.token)}` });
      setNotice("Inbjudningen är skapad och gäller i sju dagar. Dela länken med personen. Tidigare länkar för samma profil har återkallats.");
    } catch (error) {
      setError(typeof error === "object" && error && "message" in error ? String(error.message) : "Kunde inte skapa inbjudningen.");
    } finally { lock.current = false; setBusy(false); }
  }

  async function revoke(id: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await supabase.rpc("revoke_family_invitation", { p_invitation_id: id });
      if (result.error) throw result.error;
      setIssued(null); await load(); setNotice("Inbjudningen är återkallad.");
    } catch { setError("Kunde inte återkalla inbjudningen."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function copyLink() {
    if (!issued) return;
    try { await navigator.clipboard.writeText(issued.url); setNotice("Länken är kopierad."); }
    catch { setNotice("Markera och kopiera länken i fältet ovan."); }
  }

  async function shareLink() {
    if (!issued) return;
    if (!navigator.share) { await copyLink(); return; }
    try { await navigator.share({ title: "Välkommen till Vardilo", text: "Här är din inbjudan till familjens Vardilo.", url: issued.url }); }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setNotice("Kunde inte öppna delning. Använd Kopiera länken istället."); }
  }

  const active = invitations.filter(invitation => invitationStatus(invitation) === "pending");
  const history = invitations.filter(invitation => invitationStatus(invitation) !== "pending");
  const available = members.filter(member => member.role !== "barn" && !member.user_id);

  function invitationRow(invitation: Invitation) {
    const member = members.find(member => member.id === invitation.member_id);
    const status = invitationStatus(invitation);
    const newest = invitations.find(row => row.member_id === invitation.member_id)?.id === invitation.id;
    return <div key={invitation.id} style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <strong>{member?.display_name ?? "Familjeprofil"}</strong>
        <p>{invitation.email}</p>
        <p className="muted">{invitationStatusLabels[status]} · {status === "accepted" && invitation.accepted_at ? dateLabel(invitation.accepted_at) : status === "pending" ? `Gäller till ${dateLabel(invitation.expires_at)}` : "Länken kan inte användas"}</p>
      </div>
      {status === "pending" ? <button type="button" className="secondary" disabled={busy} onClick={() => void revoke(invitation.id)}>Återkalla</button> : newest && member && !member.user_id && member.role !== "barn" && status !== "accepted" && <button type="button" className="secondary" disabled={busy} onClick={() => void issue(member.id, invitation.email)}>Skapa ny länk</button>}
    </div>;
  }

  return <section style={{ padding: 22, borderBottom: "1px solid var(--line)" }}>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}><h3>Bjud in till familjen</h3><button className="secondary" type="button" disabled={busy || loading} onClick={() => { setError(""); void load().then(() => changed.current()); }}>Uppdatera</button></div>
    <p className="muted">Lägg först till personens familjeprofil och välj roll. Inbjudningen kan bara accepteras med den e-postadress du anger. Barn använder Barnens inloggningar.</p>
    {!available.length && <p className="muted">Alla vuxenprofiler har redan ett konto. Lägg till en ny familjeprofil ovan för att bjuda in någon mer.</p>}
    <form onSubmit={event => { event.preventDefault(); void issue(memberId, email); }} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <label className="family-admin-field"><span>Familjeprofil</span><select value={memberId} disabled={busy || !available.length} onChange={event => { setMemberId(event.target.value); setIssued(null); }} required><option value="">Välj person</option>{available.map(member => <option key={member.id} value={member.id}>{member.display_name} · {member.role === "familj" ? "Familjemedlem" : member.role}</option>)}</select></label>
      <label className="family-admin-field"><span>Personens e-post</span><input type="email" value={email} disabled={busy || !available.length} onChange={event => { setEmail(event.target.value); setIssued(null); }} maxLength={254} required /></label>
      <div><button className="primary" type="submit" disabled={busy || !available.some(member => member.id === memberId) || !email.trim()}>{busy ? "Arbetar…" : "Skapa inbjudningslänk"}</button></div>
    </form>
    {loadError && <p role="alert">{loadError}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {issued && <div style={{ display: "grid", gap: 10, maxWidth: 600 }}><label className="family-admin-field"><span>Inbjudningslänk</span><input readOnly value={issued.url} onFocus={event => event.target.select()} /></label><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button className="secondary" type="button" onClick={() => void copyLink()}>Kopiera länken</button><button className="secondary" type="button" onClick={() => void shareLink()}>Dela inbjudningen</button></div></div>}
    {loading && <p role="status">Laddar inbjudningar…</p>}
    {!loading && <><h4>Väntar på svar ({active.length})</h4>{active.length ? active.map(invitationRow) : <p className="muted">Inga väntande inbjudningar.</p>}{history.length > 0 && <details><summary style={{ cursor: "pointer", padding: "14px 0" }}>Tidigare inbjudningar ({history.length})</summary>{history.map(invitationRow)}</details>}</>}
  </section>;
}
