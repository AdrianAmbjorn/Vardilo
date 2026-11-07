"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BirthdaySettings from "../../components/birthday-settings";
import { normalizeChildUsername, validChildUsername } from "@/lib/child-login";

type Child = { id: string; display_name: string; role: string; user_id: string | null };
type Login = { member_id: string; username: string; parent_email: string };

export default function ChildLogins({ members, onChanged }: { members: Child[]; onChanged: () => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const [logins, setLogins] = useState<Login[]>([]);
  const [parentEmail, setParentEmail] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const loadVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);

  async function load() {
    const request = ++loadVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (request !== loadVersion.current) return false;
      if (authError || !auth.user?.email) throw Error();
      const { data, error } = await supabase.from("family_child_logins").select("member_id,username,parent_email").eq("guardian_user_id", auth.user.id);
      if (request !== loadVersion.current) return false;
      if (error) throw error;
      setParentEmail(auth.user.email);
      setLogins(data ?? []);
      setLoaded(true);
      return true;
    } catch { if (request === loadVersion.current) { setLoaded(false); setLoadError("Kunde inte läsa barnens inloggningar. Uppdatera kontostatus innan du gör ändringar."); } return false; }
    finally { if (request === loadVersion.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { loadVersion.current++; }; }, [supabase]);

  async function save(event: React.FormEvent<HTMLFormElement>, child: Child) {
    event.preventDefault();
    if (lock.current || loading || !loaded) return;
    const login = logins.find(item => item.member_id === child.id);
    if (!login && !guardianConfirmed) { setError("Bekräfta först att du är barnets vårdnadshavare."); return; }
    if (!login && !validChildUsername(username)) { setError("Användarnamnet ska vara 3–30 tecken: a–z, siffror, bindestreck eller understreck."); return; }
    if (password.length < 10 || password.length > 128 || password !== confirm) { setError("Ange samma lösenord i båda fälten, med 10–128 tecken."); return; }
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("manage-child-login", { body: { action: login ? "reset" : "create", memberId: child.id, username: normalizeChildUsername(username), password, guardianConfirmed } });
      if (error) {
        const response = error.context;
        if (response instanceof Response) {
          const body = await response.json().catch(() => null);
          if (typeof body?.error === "string") throw new Error(body.error);
        }
        throw new Error("Kunde inte slutföra ändringen. Kontrollera kontots status innan du försöker igen.");
      }
      if (data?.error) throw new Error(data.error);
      setPassword(""); setConfirm(""); setUsername(""); setEditing(null);
      await load();
      try { await onChanged(); } catch { setLoadError("Ändringen är sparad, men familjevyn kunde inte uppdateras. Uppdatera kontostatus."); }
      setMessage(login ? `Lösenordet för ${child.display_name} är ändrat.` : `Inloggningen för ${child.display_name} är skapad. Barnet väljer Barninloggning och använder din e-post, sitt användarnamn och sitt lösenord.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Kunde inte hantera barnkontot."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <section style={{ padding: "22px", borderBottom: "1px solid var(--line)" }}>
    <h3>Barnens inloggningar</h3>
    <p className="muted">Barnen behöver ingen egen e-postadress. Varje barn får ett eget användarnamn och lösenord, kopplat till din e-post. Du byter lösenord här om barnet glömmer det.</p>
    {loading && <p role="status">Laddar inloggningar…</p>}
    {(error || loadError) && <div>{error && <p role="alert">{error}</p>}{loadError && <p role="alert">{loadError}</p>}<button type="button" className="secondary" disabled={busy || loading} onClick={() => { setError(""); void load(); }}>Uppdatera kontostatus</button></div>}
    {message && <p role="status">{message}</p>}
    {members.filter(member => member.role === "barn").map(child => {
      const login = logins.find(item => item.member_id === child.id);
      const canCreate = !child.user_id;
      return <div key={child.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--line)", overflowWrap: "anywhere" }}>
        <strong>{child.display_name}</strong>
        <BirthdaySettings memberId={child.id} name={child.display_name} />
        <p className="muted">{!loaded ? "Kontostatus behöver uppdateras." : login ? `${login.username} · ${login.parent_email}` : child.user_id ? "Inloggning kopplad till ett annat konto." : "Ingen inloggning ännu."}</p>
        {editing === child.id ? <form onSubmit={event => void save(event, child)} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          {!login && <><p className="muted">Kopplas till {parentEmail}</p><label className="family-admin-field"><span>Barnets användarnamn</span><input value={username} disabled={busy || loading || !loaded} onChange={event => setUsername(event.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="off" maxLength={30} required /></label></>}
          {!login && <label style={{display:"flex",gap:10,alignItems:"flex-start"}}><input type="checkbox" required checked={guardianConfirmed} disabled={busy || loading || !loaded} onChange={event=>setGuardianConfirmed(event.target.checked)} /><span>Jag är barnets vårdnadshavare och har läst <a href="/barn-och-integritet" target="_blank" rel="noopener noreferrer">informationen om barnkonton</a>. Jag har förklarat för barnet vilka uppgifter som delas med familjen.</span></label>}
          <label className="family-admin-field"><span>{login ? "Nytt lösenord" : "Barnets lösenord"}</span><input type="password" value={password} disabled={busy || loading || !loaded} onChange={event => setPassword(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required /></label>
          <label className="family-admin-field"><span>Upprepa lösenordet</span><input type="password" value={confirm} disabled={busy || loading || !loaded} onChange={event => setConfirm(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required /></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="submit" className="primary" disabled={busy || loading || !loaded}>{busy ? "Sparar…" : login ? "Byt lösenord" : "Skapa barninloggning"}</button><button type="button" className="secondary" disabled={busy || loading || !loaded} onClick={() => { setEditing(null); setPassword(""); setConfirm(""); }}>Avbryt</button></div>
        </form> : (login || canCreate) && <button type="button" className="secondary" disabled={busy || loading || !loaded} onClick={() => { setGuardianConfirmed(false); setEditing(child.id); setUsername(login?.username ?? ""); setPassword(""); setConfirm(""); setError(""); setMessage(""); }}>{login ? "Byt barnets lösenord" : "Skapa barninloggning"}</button>}
      </div>;
    })}
    {loaded && !loading && !members.some(member => member.role === "barn") && <p className="muted">Lägg till en familjemedlem med rollen Barn för att skapa en barninloggning.</p>}
  </section>;
}
