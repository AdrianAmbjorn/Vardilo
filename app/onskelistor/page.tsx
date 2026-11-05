"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; display_name: string };
type Wishlist = { id: string; member_id: string; title: string };
type Wish = { id: string; title: string; url: string | null; price: number | null; purchased: boolean };
type OpenList = Wishlist & { items: Wish[] };

export default function WishlistsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<(Member & { family_id: string; role: string }) | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [lists, setLists] = useState<Wishlist[]>([]);
  const [selected, setSelected] = useState<OpenList | null>(null);
  const [title, setTitle] = useState("");
  const [person, setPerson] = useState("");
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const lock = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Logga in för att se familjens önskelistor.");
      const me = await supabase.from("family_members").select("id,family_id,display_name,role").eq("user_id", auth.user.id).maybeSingle();
      if (me.error || !me.data) throw new Error("Kunde inte hitta din familj.");
      const [family, lists] = await Promise.all([
        supabase.from("family_members").select("id,display_name").eq("family_id", me.data.family_id),
        supabase.from("family_wishlists").select("id,member_id,title").eq("family_id", me.data.family_id).order("created_at"),
      ]);
      if (family.error || lists.error) throw new Error("Kunde inte läsa önskelistorna.");
      setMember(me.data);
      setMembers(family.data);
      setLists(lists.data);
    } catch (error) { setError(error instanceof Error ? error.message : "Kunde inte läsa önskelistorna."); }
    finally { setLoading(false); }
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

  async function open(list: Wishlist) {
    if (!member) return;
    const { data, error } = await supabase.from("family_wishlist_items")
      .select("id,title,url,price,purchased").eq("wishlist_id", list.id).order("created_at");
    if (error) throw new Error("Kunde inte läsa önskningarna.");
    let nextReservations: Record<string, string> = {};
    if (member.role !== "barn" && data.length) {
      const result = await supabase.from("family_wishlist_reservations").select("item_id,reserved_by").in("item_id", data.map(item => item.id));
      if (result.error) throw new Error("Kunde inte läsa reservationerna. Försök igen.");
      nextReservations = Object.fromEntries(result.data.map(item => [item.item_id, item.reserved_by]));
    }
    setSelected({ ...list, items: data });
    setReservations(nextReservations);
  }

  function addList(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !title.trim() || !person) return;
    void run(async () => {
      const result = await supabase.from("family_wishlists")
        .insert({ family_id: member.family_id, member_id: person, title: title.trim() }).select("id,member_id,title").single();
      if (result.error) throw new Error("Kunde inte skapa önskelistan. Din text finns kvar.");
      setLists(current => [...current, result.data]);
      setTitle("");
      setPerson("");
    });
  }

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !item.trim()) return;
    void run(async () => {
      const result = await supabase.from("family_wishlist_items").insert({ wishlist_id: selected.id, title: item.trim() })
        .select("id,title,url,price,purchased").single();
      if (result.error) throw new Error("Kunde inte lägga till önskningen. Din text finns kvar.");
      setSelected({ ...selected, items: [...selected.items, result.data] });
      setItem("");
    });
  }

  function reserve(wish: Wish) {
    if (!member || member.role === "barn" || !selected) return;
    void run(async () => {
      const mine = reservations[wish.id] === member.id;
      const result = await supabase.rpc(mine ? "unreserve_wishlist_item" : "reserve_wishlist_item", { p_item_id: wish.id });
      // Reload after a competing reservation even when our attempt failed.
      await open(selected);
      if (result.error) throw new Error("Kunde inte ändra reservationen. Kontrollera önskningens senaste status och försök igen.");
    });
  }

  function toggle(wish: Wish) {
    if (!selected) return;
    void run(async () => {
      const result = await supabase.from("family_wishlist_items").update({ purchased: !wish.purchased })
        .eq("id", wish.id).eq("wishlist_id", selected.id).select("id,purchased").single();
      if (result.error) throw new Error("Kunde inte ändra köpstatus. Försök igen.");
      setSelected({ ...selected, items: selected.items.map(item => item.id === wish.id ? { ...item, purchased: result.data.purchased } : item) });
    });
  }

  return (
    <main className="section-shell">
      <header className="section-header">
        <div><p className="eyebrow">VARDILO</p><h1>Önskelistor</h1><p className="muted">Familjens önskningar och presenter.</p></div>
        <Link className="secondary" href="/">Hem</Link>
      </header>
      <section className="section-card">
        <form className="family-admin-form" onSubmit={addList}>
          <label className="family-admin-field"><span>Ny önskelista</span><input value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="T.ex. Oliwers önskelista" /></label>
          <label className="family-admin-field"><span>För</span><select value={person} disabled={busy} onChange={event => setPerson(event.target.value)}><option value="">Välj person</option>{members.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
          <button className="primary" disabled={!member || busy || !title.trim() || !person}>+ Skapa</button>
        </form>
        {error && <div className="section-row"><p role="alert">{error}</p>{!member && <button className="secondary" disabled={busy} onClick={() => { setError(""); void load(); }}>Försök igen</button>}</div>}
        {loading && <p role="status" style={{ padding: 20 }}>Laddar önskelistor…</p>}
        {lists.map(list => <div className="section-row" key={list.id}><div><strong>{list.title}</strong><p>{members.find(person => person.id === list.member_id)?.display_name}</p></div><button className="secondary" disabled={busy} onClick={() => void run(() => open(list))}>Öppna</button></div>)}
        {selected && <div style={{ marginTop: 24 }}>
          <div className="card-heading"><h3>{selected.title}</h3></div>
          <form className="family-admin-form" onSubmit={addItem}>
            <input aria-label="Ny önskning" value={item} disabled={busy} onChange={event => setItem(event.target.value)} placeholder="Lägg till önskning" />
            <button className="primary" disabled={busy || !item.trim()}>+ Lägg till</button>
          </form>
          {!selected.items.length && <p className="muted" style={{ padding: 20 }}>Inga önskningar ännu.</p>}
          {selected.items.map(wish => <div className="task-row" key={wish.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="check" disabled={busy} onClick={() => toggle(wish)} aria-label={wish.purchased ? "Markera som inte köpt" : "Markera som köpt"} aria-pressed={wish.purchased}>{wish.purchased ? "✓" : ""}</button>
            <div style={{ flex: "1 1 190px", minWidth: 0, overflowWrap: "anywhere" }}>
              <strong style={{ color: "var(--text)", textDecoration: wish.purchased ? "line-through" : "none" }}>{wish.title}</strong>
              <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{wish.purchased ? "Köpt" : member?.role === "barn" ? "På min önskelista" : reservations[wish.id] ? reservations[wish.id] === member?.id ? "Reserverad av dig" : "Redan reserverad" : "Ledig att reservera"}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {member && member.role !== "barn" && <button className="secondary" disabled={busy || Boolean(reservations[wish.id] && reservations[wish.id] !== member.id)} onClick={() => reserve(wish)}>{reservations[wish.id] === member.id ? "Avreservera" : reservations[wish.id] ? "Reserverad" : "Reservera"}</button>}
              {member && member.role !== "barn" && reservations[wish.id] === member.id && <>
                <a className="secondary" href={`https://www.prisjakt.nu/search?search=${encodeURIComponent(wish.title)}`} target="_blank" rel="noopener noreferrer">Prisjakt</a>
                <a className="secondary" href={`https://www.amazon.se/s?k=${encodeURIComponent(wish.title)}`} target="_blank" rel="noopener noreferrer">Amazon.se</a>
                <a className="secondary" href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(wish.title)}`} target="_blank" rel="noopener noreferrer">Google Shopping</a>
              </>}
            </div>
          </div>)}
        </div>}
      </section>
    </main>
  );
}
