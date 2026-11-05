"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; display_name: string };
type Request = { id: string; title: string; details: string | null; created_by_member_id: string; claimed_by_member_id: string | null; completed_at: string | null };

export default function HelpPage() {
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<(Member & { family_id: string; role: string }) | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<Request[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user) throw new Error("Logga in för att se familjens hjälpärenden.");
      const me = await supabase.from("family_members").select("id,family_id,display_name,role").eq("user_id", auth.user.id).maybeSingle();
      if (me.error || !me.data) throw new Error("Kunde inte hitta din familj.");
      setMember(me.data);
      const [requests, family] = await Promise.all([
        supabase.from("help_requests").select("id,title,details,created_by_member_id,claimed_by_member_id,completed_at")
          .eq("family_id", me.data.family_id).order("created_at", { ascending: false }),
        supabase.from("family_members").select("id,display_name").eq("family_id", me.data.family_id),
      ]);
      if (requests.error || family.error) throw new Error("Kunde inte läsa hjälpärendena.");
      setItems(requests.data);
      setMembers(family.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kunde inte läsa hjälpärendena.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : "Kunde inte spara. Försök igen."); }
    finally { lock.current = false; setBusy(false); }
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !title.trim()) return;
    void run(async () => {
      const { data, error } = await supabase.from("help_requests").insert({
        family_id: member.family_id, title: title.trim(), details: details.trim() || null, created_by_member_id: member.id,
      }).select("id,title,details,created_by_member_id,claimed_by_member_id,completed_at").single();
      if (error) throw new Error("Kunde inte spara hjälpärendet. Din text finns kvar.");
      setItems(current => [data, ...current]);
      setTitle("");
      setDetails("");
      setShowCompleted(false);
      setNotice("Din förfrågan är upplagd. Nu kan familjen hjälpa till.");
    });
  }

  function change(request: Request, action: "claim" | "release" | "complete" | "reopen" | "cancel") {
    if (!member) return;
    if (action === "release" && !window.confirm("Lämna tillbaka ärendet så att någon annan kan hjälpa till?")) return;
    if (action === "cancel" && !window.confirm(`Ta bort ”${request.title}”?`)) return;
    void run(async () => {
      const { data, error } = await supabase.rpc("change_help_request", { p_request_id: request.id, p_action: action });
      if (error || !data?.id) {
        await load();
        throw new Error(error?.code === "P0001" ? error.message : "Kunde inte ändra ärendet. Kontrollera senaste status och försök igen.");
      }
      setItems(current => data.deleted ? current.filter(item => item.id !== data.id) : current.map(item => item.id === data.id ? data as Request : item));
      if (action === "reopen") setShowCompleted(false);
      setNotice(action === "claim" ? "Tack! Familjen ser nu att du hjälper till." : action === "release" ? "Ärendet är ledigt igen." : action === "complete" ? "Hjälpen är markerad som klar. Tack för hjälpen!" : action === "reopen" ? "Ärendet är öppet igen." : "Hjälpärendet är borttaget.");
    });
  }

  const name = (id: string) => members.find(person => person.id === id)?.display_name ?? "En familjemedlem";

  const open = items.filter(item => !item.completed_at);
  const done = items.filter(item => item.completed_at);
  const visible = showCompleted ? done : open;

  return (
    <main className="section-shell">
      <header className="section-header">
        <div><p className="eyebrow">VARDILO</p><h1>Hjälp varandra</h1><p className="muted">Stort eller smått – det är lättare tillsammans.</p></div>
        <Link className="secondary" href="/">Hem</Link>
      </header>
      <section className="section-card">
        <form className="family-admin-form" onSubmit={add}>
          <label className="family-admin-field"><span>Vad behöver du hjälp med?</span><input value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="Till exempel skjuts till träningen" maxLength={160} /></label>
          <label className="family-admin-field"><span>Det som är bra att veta</span><input value={details} disabled={busy} onChange={event => setDetails(event.target.value)} placeholder="Tid, plats eller något annat viktigt" maxLength={1000} /></label>
          <button className="primary" disabled={!member || !title.trim() || busy}>Be om hjälp</button>
        </form>
        {error && <div className="section-row"><p role="alert">{error}</p><button className="secondary" type="button" disabled={busy} onClick={() => { setError(""); void load(); }}>Försök igen</button></div>}
        {loading && <p role="status" style={{ padding: 20 }}>Laddar hjälpärenden…</p>}
        {notice && <p className="section-row" role="status">{notice}</p>}
        <div role="group" aria-label="Visa hjälpärenden" style={{display:"flex",gap:8,flexWrap:"wrap",padding:"16px 22px"}}>
          <button type="button" className={showCompleted?"secondary":"primary"} aria-pressed={!showCompleted} onClick={()=>setShowCompleted(false)}>Öppna ({open.length})</button>
          <button type="button" className={showCompleted?"primary":"secondary"} aria-pressed={showCompleted} onClick={()=>setShowCompleted(true)}>Klara ({done.length})</button>
        </div>
        {visible.map(request => (
          <div className="section-row" key={request.id} style={{ flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              <strong>{request.title}</strong>
              <p>{request.claimed_by_member_id ? `${name(request.claimed_by_member_id)} ${request.completed_at ? "hjälpte" : "hjälper"} ${name(request.created_by_member_id)}` : `${name(request.created_by_member_id)} ${request.completed_at ? "· Klart" : "behöver hjälp"}`}</p>
              {request.details && <p>{request.details}</p>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <span className="tag green">{request.completed_at?"Klar":request.claimed_by_member_id?"Pågår":"Ledig"}</span>
              {request.completed_at ? (request.created_by_member_id===member?.id||request.claimed_by_member_id===member?.id||member?.role==="admin") && <button className="secondary" type="button" disabled={busy} onClick={()=>change(request,"reopen")}>Öppna igen</button> : <>
                {!request.claimed_by_member_id && request.created_by_member_id!==member?.id && <button className="primary" type="button" disabled={busy} onClick={()=>change(request,"claim")}>Jag kan hjälpa till</button>}
                {(request.created_by_member_id===member?.id||request.claimed_by_member_id===member?.id||member?.role==="admin") && <button className="secondary" type="button" disabled={busy} onClick={()=>change(request,"complete")}>Markera klart</button>}
                {request.claimed_by_member_id && (request.claimed_by_member_id===member?.id||member?.role==="admin") && <button className="secondary" type="button" disabled={busy} onClick={()=>change(request,"release")}>{request.claimed_by_member_id===member?.id?"Lämna tillbaka":"Gör ledig"}</button>}
              </>}
              {(request.created_by_member_id===member?.id||member?.role==="admin") && <button className="secondary" type="button" disabled={busy} onClick={()=>change(request,"cancel")}>Ta bort</button>}
            </div>
          </div>
        ))}
        {!loading && !error && !visible.length && <p className="muted" style={{ padding: 20 }}>{showCompleted?"Här samlas hjälpen som blivit klar.":"Ingen behöver hjälp just nu."}</p>}
      </section>
    </main>
  );
}
