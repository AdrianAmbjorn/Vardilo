"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { wishUrl, wishPrice, safeWishUrl, formatWishPrice } from "@/lib/wishlist-details";
import "./wishlists.css";
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
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editPrice, setEditPrice] = useState("");
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
      if(me.data.role==="barn")setPerson(me.data.id);
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
    const { data, error } = await supabase.rpc("get_wishlist_items", { p_wishlist_id: list.id });
    if (error) throw new Error("Kunde inte läsa önskningarna.");
    let nextReservations: Record<string, string> = {};
    if (member.role !== "barn" && data.length) {
      const result = await supabase.from("family_wishlist_reservations").select("item_id,reserved_by").in("item_id", data.map((item: Wish) => item.id));
      if (result.error) throw new Error("Kunde inte läsa reservationerna. Försök igen.");
      nextReservations = Object.fromEntries(result.data.map(item => [item.item_id, item.reserved_by]));
    }
    setSelected({ ...list, items: data });
    setEditing(null);
    if (selected?.id !== list.id) { setItem(""); setUrl(""); setPrice(""); }
    setReservations(nextReservations);
  }

  function deleteList() {
    if(!member||!selected||busy||editing)return;
    if(!window.confirm(`Ta bort önskelistan ”${selected.title}” och alla önskningar i den?`))return;
    void run(async()=>{
      const {data,error}=await supabase.from("family_wishlists").delete().eq("id",selected.id).eq("family_id",member.family_id).select("id").maybeSingle();
      if(error||!data)throw new Error("Kunde inte ta bort önskelistan. Försök igen.");
      setLists(current=>current.filter(list=>list.id!==selected.id));setSelected(null);setReservations({});setEditing(null);setItem("");setUrl("");setPrice("");
    });
  }

  function addList(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !title.trim() || !person || (member.role === "barn" && person !== member.id)) return;
    void run(async () => {
      const result = await supabase.from("family_wishlists")
        .insert({ family_id: member.family_id, member_id: person, title: title.trim() }).select("id,member_id,title").single();
      if (result.error) throw new Error("Kunde inte skapa önskelistan. Din text finns kvar.");
      setLists(current => [...current, result.data]);
      setSelected({ ...result.data, items: [] }); setReservations({}); setEditing(null); setItem(""); setUrl(""); setPrice("");
      setTitle("");
      setPerson(member.role === "barn" ? member.id : "");
    });
  }

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !item.trim() || editing) return;
    void run(async () => {
      const result = await supabase.from("family_wishlist_items").insert({ wishlist_id: selected.id, title: item.trim(), url: wishUrl(url), price: wishPrice(price) })
        .select("id,title,url,price").single();
      if (result.error) throw new Error("Kunde inte lägga till önskningen. Din text finns kvar.");
      setSelected({ ...selected, items: [...selected.items, { ...result.data, purchased: false }] });
      setItem(""); setUrl(""); setPrice("");
    });
  }

  function beginEdit(wish: Wish) {
    if (busy) return;
    setEditing(wish.id); setEditTitle(wish.title); setEditUrl(wish.url ?? ""); setEditPrice(wish.price === null ? "" : String(wish.price).replace(".", ",")); setError("");
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editing || !editTitle.trim()) return;
    void run(async () => {
      const { data, error } = await supabase.from("family_wishlist_items")
        .update({ title: editTitle.trim(), url: wishUrl(editUrl), price: wishPrice(editPrice) })
        .eq("id", editing).eq("wishlist_id", selected.id).select("id,title,url,price").single();
      if (error) throw new Error("Kunde inte spara ändringarna. Din text finns kvar.");
      setSelected({ ...selected, items: selected.items.map(wish => wish.id === data.id ? { ...data, purchased: wish.purchased } : wish) }); setEditing(null);
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
    if (!selected || !member || member.role === "barn") return;
    void run(async () => {
      const result = await supabase.from("family_wishlist_items").update({ purchased: !wish.purchased })
        .eq("id", wish.id).eq("wishlist_id", selected.id).select("id").single();
      if (result.error) throw new Error("Kunde inte ändra köpstatus. Försök igen.");
      setSelected({ ...selected, items: selected.items.map(item => item.id === wish.id ? { ...item, purchased: !wish.purchased } : item) });
    });
  }

  return (
    <main className={`section-shell wishlist-page ${selected ? "has-selection" : ""}`}>
      <header className="section-header"><div><p className="eyebrow">VARDILO</p><h1>Önskelistor</h1><p className="muted">Små och stora saker att önska sig.</p></div><Link className="secondary" href="/">Hem</Link></header>
      {error && !editing && <div className="wishlist-error"><p role="alert">{error}</p>{!member && <button className="secondary" disabled={busy} onClick={() => { setError(""); void load(); }}>Försök igen</button>}</div>}
      <div className="wishlist-workspace">
        <aside className="wishlist-sidebar" aria-label="Familjens önskelistor">
          <h2>Familjens önskelistor</h2>
          {loading && <p role="status" className="muted">Laddar önskelistor…</p>}
          {!loading && !lists.length && <p className="muted">Här finns plats för familjens önskningar.</p>}
          <div className="wishlist-nav">{lists.map(list => <button type="button" key={list.id} disabled={busy || Boolean(editing)} aria-pressed={selected?.id === list.id} onClick={() => void run(() => open(list))}><span aria-hidden="true">🎁</span><span><strong>{list.title}</strong><small>{members.find(person => person.id === list.member_id)?.display_name}</small></span><span aria-hidden="true">›</span></button>)}</div>
          <details className="wishlist-create"><summary>+ Ny önskelista</summary>
            <form onSubmit={addList} className="wishlist-form">
              <label>Listans namn<input value={title} disabled={busy || Boolean(editing)} maxLength={100} onChange={event => setTitle(event.target.value)} placeholder="Till exempel födelsedag" required /></label>
              <label>Vems önskningar?<select value={person} disabled={busy || Boolean(editing)} onChange={event => setPerson(event.target.value)} required><option value="">Välj person</option>{members.filter(person => member?.role !== "barn" || person.id === member.id).map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
              <button className="primary" disabled={!member || busy || Boolean(editing) || !title.trim() || !person}>Skapa önskelista</button>
            </form>
          </details>
        </aside>
        <section className="wishlist-detail" data-empty={!selected}>
          {selected ? <>
            <header className="wishlist-detail-heading"><button className="secondary wishlist-back" type="button" disabled={busy || Boolean(editing)} onClick={() => { setSelected(null); setEditing(null); }}>‹ Alla önskelistor</button><p className="eyebrow">{members.find(person => person.id === selected.member_id)?.display_name ?? "Familjen"}</p><h2>{selected.title}</h2>{member&&(selected.member_id===member.id||["admin","förälder"].includes(member.role))&&<button type="button" className="secondary wishlist-delete" disabled={busy||Boolean(editing)} onClick={deleteList}>Ta bort önskelistan</button>}<p className="muted">{selected.items.length} {selected.items.length === 1 ? "önskning" : "önskningar"}</p></header>
            <details className="wishlist-add" key={selected.id} open={selected.items.length === 0 ? true : undefined}><summary>+ Lägg till en önskning</summary>
              <form className="wishlist-form" onSubmit={addItem}>
                <label>Vad önskar du dig?<input value={item} disabled={busy || Boolean(editing)} maxLength={160} onChange={event => setItem(event.target.value)} placeholder="Till exempel en bok eller ett spel" required /></label>
                <div className="wishlist-fields"><label>Länk (valfri)<input inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={url} disabled={busy || Boolean(editing)} onChange={event => setUrl(event.target.value)} placeholder="https://…" maxLength={2000} /></label><label>Ungefärligt pris (kr)<input inputMode="decimal" value={price} disabled={busy || Boolean(editing)} onChange={event => setPrice(event.target.value)} placeholder="Till exempel 299,50" maxLength={20} /></label></div>
                <div><button className="primary" disabled={busy || Boolean(editing) || !item.trim()}>Spara önskning</button></div>
              </form>
            </details>
            {!selected.items.length && <p className="muted wishlist-empty">Vad står på önskelistan? Lägg till den första önskningen ovan.</p>}
            <div className="wishlist-items">{selected.items.map(wish => {
              const source = safeWishUrl(wish.url);
              return <article className="wishlist-item" key={wish.id}>
                {editing === wish.id ? <form className="wishlist-form" onSubmit={saveEdit}>
                  <h3>Ändra önskning</h3><label>Önskning<input value={editTitle} disabled={busy} maxLength={160} onChange={event => setEditTitle(event.target.value)} required /></label>
                  <div className="wishlist-fields"><label>Länk (valfri)<input inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={editUrl} disabled={busy} onChange={event => setEditUrl(event.target.value)} maxLength={2000} /></label><label>Ungefärligt pris (kr)<input inputMode="decimal" value={editPrice} disabled={busy} onChange={event => setEditPrice(event.target.value)} maxLength={20} /></label></div>
                  {error && <p role="alert" className="wishlist-inline-error">{error}</p>}
                  <div className="wishlist-actions"><button className="primary" disabled={busy || !editTitle.trim()}>{busy ? "Sparar…" : "Spara ändringar"}</button><button className="secondary" type="button" disabled={busy} onClick={() => { setEditing(null); setError(""); }}>Avbryt</button></div>
                </form> : <>
                  <div className="wishlist-item-main">{member?.role !== "barn" && <button className="wish-check" type="button" role="checkbox" aria-checked={wish.purchased} disabled={busy || Boolean(editing)} onClick={() => toggle(wish)} aria-label={`${wish.purchased ? "Markera som inte köpt" : "Markera som köpt"}: ${wish.title}`}>{wish.purchased ? "✓" : ""}</button>}<div><h3 style={{ textDecoration: member?.role !== "barn" && wish.purchased ? "line-through" : "none" }}>{wish.title}</h3>{wish.price !== null && <p className="wish-price">Cirka {formatWishPrice(wish.price)}</p>}<p className="wish-status">{member?.role === "barn" ? "En önskning" : wish.purchased ? "Köpt" : reservations[wish.id] ? reservations[wish.id] === member?.id ? "Reserverad av dig" : "Reserverad" : "Ledig att reservera"}</p></div></div>
                  <div className="wishlist-actions">{source && <a className="secondary" href={source} target="_blank" rel="noopener noreferrer">Se önskningen ↗</a>}<button className="secondary" type="button" disabled={busy || Boolean(editing)} onClick={() => beginEdit(wish)}>Ändra</button>{member && member.role !== "barn" && <button className={reservations[wish.id] ? "secondary" : "primary"} type="button" disabled={busy || Boolean(editing) || Boolean(reservations[wish.id] && reservations[wish.id] !== member.id)} onClick={() => reserve(wish)}>{reservations[wish.id] === member.id ? "Ångra reservation" : reservations[wish.id] ? "Reserverad" : "Reservera"}</button>}</div>
                  {member && member.role !== "barn" && reservations[wish.id] === member.id && <details className="wishlist-compare"><summary>Jämför priser</summary><div><a href={`https://www.prisjakt.nu/search?search=${encodeURIComponent(wish.title)}`} target="_blank" rel="noopener noreferrer">Prisjakt ↗</a><a href={`https://www.amazon.se/s?k=${encodeURIComponent(wish.title)}`} target="_blank" rel="noopener noreferrer">Amazon.se ↗</a><a href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(wish.title)}`} target="_blank" rel="noopener noreferrer">Google Shopping ↗</a></div></details>}
                </>}
              </article>;
            })}</div>
          </> : <div className="wishlist-welcome"><span aria-hidden="true">🎁</span><h2>Vad längtar ni efter?</h2><p>Välj en önskelista eller skapa en ny till någon i familjen.</p></div>}
        </section>
      </div>
    </main>
  );
}
