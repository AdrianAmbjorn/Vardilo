"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; display_name: string };
type Request = { id: string; title: string; details: string | null; created_by_member_id: string; claimed_by_member_id: string | null };

export default function HelpPage() {
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<(Member & { family_id: string }) | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<Request[]>([]);
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
      const me = await supabase.from("family_members").select("id,family_id,display_name").eq("user_id", auth.user.id).maybeSingle();
      if (me.error || !me.data) throw new Error("Kunde inte hitta din familj.");
      setMember(me.data);
      const [requests, family] = await Promise.all([
        supabase.from("help_requests").select("id,title,details,created_by_member_id,claimed_by_member_id")
          .eq("family_id", me.data.family_id).is("completed_at", null).order("created_at", { ascending: false }),
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
      }).select("id,title,details,created_by_member_id,claimed_by_member_id").single();
      if (error) throw new Error("Kunde inte spara hjälpärendet. Din text finns kvar.");
      setItems(current => [data, ...current]);
      setTitle("");
      setDetails("");
    });
  }

  function claim(request: Request) {
    if (!member || request.claimed_by_member_id) return;
    void run(async () => {
      const { data, error } = await supabase.from("help_requests")
        .update({ claimed_by_member_id: member.id, claimed_at: new Date().toISOString() })
        .eq("id", request.id).eq("family_id", member.family_id).is("claimed_by_member_id", null)
        .select("id,title,details,created_by_member_id,claimed_by_member_id").maybeSingle();
      if (error) throw new Error("Kunde inte ta hjälpärendet. Försök igen.");
      if (!data) {
        await load();
        throw new Error("Någon annan hann ta ärendet. Listan har uppdaterats.");
      }
      setItems(current => current.map(item => item.id === data.id ? data : item));
    });
  }

  const name = (id: string) => members.find(person => person.id === id)?.display_name ?? "En familjemedlem";

  return (
    <main className="section-shell">
      <header className="section-header">
        <div><p className="eyebrow">VARDILO</p><h1>Hjälp</h1><p className="muted">Se vad familjen behöver hjälp med och ta ansvar.</p></div>
        <Link className="secondary" href="/">Hem</Link>
      </header>
      <section className="section-card">
        <form className="family-admin-form" onSubmit={add}>
          <label className="family-admin-field"><span>Vad behöver du hjälp med?</span><input value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="T.ex. Kan någon skjutsa Oliwer?" /></label>
          <label className="family-admin-field"><span>Detaljer</span><input value={details} disabled={busy} onChange={event => setDetails(event.target.value)} placeholder="Tid, plats eller annan information" /></label>
          <button className="primary" disabled={!member || !title.trim() || busy}>+ Be om hjälp</button>
        </form>
        {error && <div className="section-row"><p role="alert">{error}</p><button className="secondary" type="button" disabled={busy} onClick={() => { setError(""); void load(); }}>Försök igen</button></div>}
        {loading && <p role="status" style={{ padding: 20 }}>Laddar hjälpärenden…</p>}
        {items.map(request => (
          <div className="section-row" key={request.id} style={{ flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              <strong>{request.title}</strong>
              <p>{request.claimed_by_member_id ? `${name(request.claimed_by_member_id)} hjälper ${name(request.created_by_member_id)}` : `${name(request.created_by_member_id)} behöver hjälp`}</p>
              {request.details && <p>{request.details}</p>}
            </div>
            {request.claimed_by_member_id ? <span className="tag green">Tagen</span> :
              <button className="secondary" type="button" disabled={busy} onClick={() => claim(request)}>Jag tar den</button>}
          </div>
        ))}
        {!loading && !error && !items.length && <p className="muted" style={{ padding: 20 }}>Ingen behöver hjälp just nu.</p>}
      </section>
    </main>
  );
}
