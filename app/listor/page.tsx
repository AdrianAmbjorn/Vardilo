"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const categories = ["Mathandling", "Storhelg", "Fest", "Hemmet"] as const;
type Category = typeof categories[number];
type FamilyList = { id: string; name: string; category: Category | "Övrigt" };

const categoryEmoji: Record<Category, string> = {
  Mathandling: "🛒",
  Storhelg: "🎄",
  Fest: "🎉",
  Hemmet: "🏠",
};

function categoryLabel(category: Category) {
  return category === "Hemmet" ? "Till hemmet" : category;
}

function categoryOptions() {
  return categories.map(category => (
    <option key={category} value={category}>{categoryEmoji[category]} {categoryLabel(category)}</option>
  ));
}
type ListItem = { id: string; text: string; completed: boolean; created_by_member_id: string | null; completed_by_member_id: string | null };
type OpenList = FamilyList & { items: ListItem[] };
type Member = { id: string; family_id: string; role: string; userId: string };

const typedText = { color: "#102a43", WebkitTextFillColor: "#102a43", caretColor: "#102a43" };

export default function ListsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<Member | null>(null);
  const [familyMembers, setFamilyMembers] = useState<{ id: string; display_name: string }[]>([]);
  const [lists, setLists] = useState<FamilyList[]>([]);
  const [selected, setSelected] = useState<OpenList | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [item, setItem] = useState("");
  const [listName, setListName] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ listId: string; itemId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const operation = useRef(false);
  const itemDrafts = useRef<Record<string, string>>({});
  const openedFromHome = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!auth.user && (!authError || authError.name === "AuthSessionMissingError")) {
        setLoadError("Logga in för att se familjens listor.");
        return;
      }
      if (authError || !auth.user) throw authError;
      const { data: profile, error: profileError } = await supabase.from("family_members")
        .select("id,family_id,role").eq("user_id", auth.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        setLoadError("Ditt konto behöver vara kopplat till en familj för att visa listor.");
        return;
      }
      const { data, error } = await supabase.from("family_lists")
        .select("id,name,category").eq("family_id", profile.family_id).order("created_at");
      if (error) throw error;
      const family = await supabase.from("family_members").select("id,display_name").eq("family_id", profile.family_id);
      if (family.error) throw family.error;
      setFamilyMembers(family.data);
      setMember({ ...profile, userId: auth.user.id });
      setLists(data ?? []);
    } catch {
      setLoadError("Kunde inte hämta familjens listor.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!member || openedFromHome.current || !lists.length) return;
    const id = new URLSearchParams(window.location.search).get("lista");
    if (!id) return;
    const list = lists.find(list => list.id === id);
    if (!list) return;
    openedFromHome.current = true;
    open(list);
  }, [member, lists]);

  async function run(action: () => Promise<void>, message: string) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch {
      setError(message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  function addList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !name.trim() || !category) return;
    void run(async () => {
      const { data, error } = await supabase.from("family_lists")
        .insert({ family_id: member.family_id, name: name.trim(), category, created_by: member.userId })
        .select("id,name,category").single();
      if (error) throw error;
      setLists(current => [...current, data]);
      setSelected({ ...data, items: [] });
      setListName(data.name);
      setItem("");
      setName("");
      setCategory("");
    }, "Kunde inte skapa listan. Försök igen.");
  }

  function open(list: FamilyList) {
    setDeleteTarget(null);
    void run(async () => {
      const { data, error } = await supabase.from("family_list_items")
        .select("id,text,completed,created_by_member_id,completed_by_member_id").eq("list_id", list.id).order("created_at");
      if (error) throw error;
      setSelected({ ...list, items: data ?? [] });
      setListName(list.name);
      if (selected?.id !== list.id) setItem(itemDrafts.current[list.id] ?? "");
    }, "Kunde inte öppna listan. Försök igen.");
  }

  function renameList(event: FormEvent<HTMLFormElement>, list: OpenList) {
    event.preventDefault();
    const name = listName.trim();
    if (!member || !name || name === list.name) return;
    void run(async () => {
      const { data, error } = await supabase.from("family_lists")
        .update({ name }).eq("id", list.id).eq("family_id", member.family_id)
        .select("id,name,category").single();
      if (error) throw error;
      setLists(current => current.map(entry => entry.id === data.id ? data : entry));
      setSelected({ ...list, ...data });
      setListName(data.name);
    }, "Kunde inte byta namn på listan. Försök igen.");
  }

  function changeCategory(list: OpenList, category: Category) {
    if (list.category === category) return;
    void run(async () => {
      const { data, error } = await supabase.from("family_lists")
        .update({ category }).eq("id", list.id)
        .select("id,name,category").single();
      if (error) throw error;
      setLists(current => current.map(entry => entry.id === data.id ? data : entry));
      setSelected({ ...list, ...data });
    }, "Kunde inte ändra kategori. Försök igen.");
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !member || !item.trim()) return;
    void run(async () => {
      const { data, error } = await supabase.from("family_list_items")
        .insert({ list_id: selected.id, text: item.trim(), created_by_member_id: member.id })
        .select("id,text,completed,created_by_member_id,completed_by_member_id").single();
      if (error) throw error;
      setSelected({ ...selected, items: [...selected.items, data] });
      delete itemDrafts.current[selected.id];
      setItem("");
    }, "Kunde inte lägga till listpunkten. Försök igen.");
  }

  function removeList(list: OpenList) {
    if (!member || member.role !== "admin") return;
    void run(async () => {
      const { error } = await supabase.from("family_lists").delete()
        .eq("id", list.id).eq("family_id", member.family_id).select("id").single();
      if (error) throw error;
      setLists(current => current.filter(entry => entry.id !== list.id));
      setSelected(null);
      delete itemDrafts.current[list.id];
      setDeleteTarget(null);
      setItem("");
    }, "Kunde inte ta bort listan. Försök igen.");
  }

  function removeItem(list: OpenList, entry: ListItem) {
    void run(async () => {
      const { error } = await supabase.from("family_list_items").delete()
        .eq("id", entry.id).eq("list_id", list.id).select("id").single();
      if (error) throw error;
      setSelected({ ...list, items: list.items.filter(item => item.id !== entry.id) });
      setDeleteTarget(null);
    }, "Kunde inte ta bort listpunkten. Försök igen.");
  }

  function toggle(entry: ListItem) {
    if (!selected) return;
    void run(async () => {
      const { data, error } = await supabase.from("family_list_items")
        .update({ completed: !entry.completed }).eq("id", entry.id).eq("list_id", selected.id)
        .select("id,text,completed,created_by_member_id,completed_by_member_id").single();
      if (error) throw error;
      setSelected({ ...selected, items: selected.items.map(item => item.id === data.id ? data : item) });
    }, "Kunde inte ändra listpunkten. Försök igen.");
  }

  function confirmRemoval(message: string, onConfirm: () => void) {
    return (
      <div style={{ flexBasis: "100%", padding: 10, border: "1px solid var(--line)", borderRadius: 10 }}>
        <p role="status" style={{ margin: "0 0 8px" }}>{message}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={busy}>Avbryt</button>
          <button className="secondary" type="button" onClick={onConfirm} disabled={busy}>Bekräfta borttagning</button>
        </div>
      </div>
    );
  }

  return (
    <main className="section-shell reminders-page">
      <style>{`
        .reminders-page { padding: 32px clamp(14px, 4vw, 56px); }
        .reminders-page > .section-header { max-width: 1100px; grid-template-columns: minmax(0, 1fr) auto; }
        .reminders-workspace { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 18px; align-items: start; }
        .reminders-sidebar, .reminders-detail { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: 0 8px 28px rgba(16,42,67,.04); min-width: 0; overflow: hidden; }
        .reminders-sidebar { padding: 16px 12px; }
        .reminders-sidebar h2 { font-size: 12px; color: var(--muted); margin: 22px 10px 8px; letter-spacing: .03em; }
        .reminders-sidebar h2 span { margin-right: 5px; }
        .reminders-create > summary { cursor: pointer; list-style: none; padding: 10px; min-height: 44px; display: flex; align-items: center; gap: 7px; color: var(--accent); font-weight: 700; }
        .reminders-create > summary::-webkit-details-marker { display: none; }
        .reminders-page .family-admin-form { display: grid; padding: 12px; gap: 12px; }
        .reminders-page .family-admin-field { min-width: 0; margin: 0; }
        .reminders-page input:not([type=checkbox]), .reminders-page select { width: 100%; min-width: 0; min-height: 44px; border: 1px solid var(--line); border-radius: 10px; background: #fbfcfd; padding: 10px 12px; font-size: 16px; }
        .reminders-list-button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; border: 0; border-radius: 11px; padding: 11px 12px; background: transparent; color: var(--text); text-align: left; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
        .reminders-list-button[aria-expanded=true] { background: var(--accent-soft); color: var(--accent); }
        .reminders-list-symbol { color: var(--accent); font-size: 21px; }
        .reminders-detail { min-height: 340px; }
        .reminders-heading { padding: 24px 24px 16px; }
        .reminders-heading h2 { font-size: clamp(24px, 5vw, 32px); line-height: 1.2; letter-spacing: -.03em; margin: 8px 0; color: var(--accent); overflow-wrap: anywhere; }
        .reminders-category { color: var(--muted); font-size: 12px; }
        .reminders-progress { color: var(--muted); font-size: 13px; margin: 0; }
        .reminders-settings { margin: 0 24px 8px; border-bottom: 1px solid var(--line); }
        .reminders-settings > summary { list-style: none; cursor: pointer; color: var(--muted); font-size: 13px; padding: 8px 0 12px; min-height: 40px; }
        .reminders-settings > summary::-webkit-details-marker { display: none; }
        .reminders-settings > summary::before { content: "⋯"; display: inline-block; margin-right: 7px; font-weight: 800; }
        .reminders-settings .family-admin-form { padding: 8px 0 12px; }
        .reminders-items { padding: 0 24px; }
        .reminders-item { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 10px; padding: 15px 0; border-bottom: 1px solid var(--line); }
        .reminders-check { position: relative; display: grid; place-items: center; width: 44px; height: 44px; flex: 0 0 44px; margin: -8px 0 0 -9px; border: 0; border-radius: 50%; background: transparent; color: white; padding: 0; }
        .reminders-check::before { content: ""; position: absolute; inset: 9px; border: 1.5px solid #9caaba; border-radius: 50%; background: white; }
        .reminders-check svg { position: relative; }
        .reminders-check[aria-checked=true]::before { background: var(--accent); border-color: var(--accent); }
        .reminders-item-text { flex: 1 1 90px; min-width: 0; overflow-wrap: anywhere; }
        .reminders-item-title { display: flex; align-items: baseline; gap: 5px; font-size: 16px; line-height: 1.5; }
        .reminders-item-title strong { font-weight: 500; }
        .reminders-star { color: #7a8998; font-size: 12px; }
        .reminders-item[data-completed=true] .reminders-item-title strong { color: var(--muted); text-decoration: line-through; }
        .reminders-attribution { color: var(--muted); font-size: 12px; line-height: 1.55; padding-left: 10px; margin: 3px 0 0; }
        .reminders-attribution span { display: block; }
        .reminders-delete { flex: 0 0 44px; display: grid; place-items: center; min-height: 44px; border: 0; border-radius: 10px; background: transparent; color: var(--muted); padding: 8px; }
        .reminders-delete:hover { color: var(--red); background: var(--red-soft); }
        .reminders-page .reminders-add-item { display: flex; align-items: center; gap: 8px; margin: 12px 24px 22px; padding: 0; }
        .reminders-add-item input { flex: 1; }
        .reminders-add-item button { flex-shrink: 0; min-height: 44px; }
        .reminders-empty { padding: 24px; color: var(--muted); font-size: 14px; }
        .reminders-notice { padding: 12px 20px; }
        .reminders-back { display: none; }
        .reminders-page button:focus-visible, .reminders-page summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
        .reminders-page button:disabled { opacity: .5; cursor: default; }
        @media(max-width: 700px) {
          .reminders-workspace { grid-template-columns: minmax(0, 1fr); }
          .reminders-workspace.has-selection .reminders-sidebar { display: none; }
          .reminders-workspace:not(.has-selection) .reminders-detail { display: none; }
          .reminders-heading { padding: 18px 18px 14px; }
          .reminders-settings { margin-inline: 18px; }
          .reminders-items { padding-inline: 18px; }
          .reminders-page .reminders-add-item { margin-inline: 18px; }
          .reminders-back { display: inline-flex; align-items: center; min-height: 40px; padding: 0; margin-bottom: 6px; border: 0; background: transparent; color: var(--accent); font-size: 14px; font-weight: 600; }
        }
      `}</style>
      <header className="section-header">
        <div>
          <p className="eyebrow">VARDILO</p>
          <h1>Listor</h1>
          <p className="muted">Familjens önskningar, inköp och planer.</p>
        </div>
        <Link className="secondary" href="/">Hem</Link>
      </header>
      {loading && <p role="status" className="reminders-notice">Laddar listor…</p>}
      {loadError && <div className="reminders-notice"><p role="alert">{loadError}</p><button className="secondary" onClick={() => void load()}>Försök igen</button></div>}
      {error && <p role="alert" className="reminders-notice">{error}</p>}
      <div className={selected ? "reminders-workspace has-selection" : "reminders-workspace"}>
        <aside className="reminders-sidebar" aria-label="Familjens listor">
          {member && (
            <details className="reminders-create">
              <summary><span aria-hidden="true">＋</span> Ny lista</summary>
              <form className="family-admin-form" onSubmit={addList}>
                <label className="family-admin-field"><span>Listans namn</span><input style={typedText} value={name} onChange={event => setName(event.target.value)} placeholder="T.ex. Julen" disabled={busy} /></label>
                <label className="family-admin-field"><span>Kategori</span><select value={category} onChange={event => setCategory(event.target.value as Category | "")} disabled={busy} required><option value="" disabled>Välj kategori</option>{categoryOptions()}</select></label>
                <button className="primary" disabled={busy || !name.trim() || !category}>Skapa lista</button>
              </form>
            </details>
          )}
          {([...categories, "Övrigt"] as const).map(group => {
            const groupLists = lists.filter(list => list.category === group);
            if (!groupLists.length) return null;
            return (
              <section key={group} aria-label={group === "Övrigt" ? "Listor utan kategori" : categoryLabel(group)}>
                {group !== "Övrigt" && <h2><span aria-hidden="true">{categoryEmoji[group]}</span>{categoryLabel(group)}</h2>}
                {groupLists.map(list => (
                  <button className="reminders-list-button" key={list.id} aria-expanded={selected?.id === list.id} onClick={() => open(list)} disabled={busy}>
                    <span className="reminders-list-symbol" aria-hidden="true">☷</span>{list.name}
                  </button>
                ))}
              </section>
            );
          })}
          {!loading && !loadError && !lists.length && <p className="reminders-empty">Skapa familjens första lista med Ny lista.</p>}
        </aside>
        <section className="reminders-detail" aria-label={selected?.name ?? "Välj en lista"}>
          {selected ? <>
            <div className="reminders-heading">
              <button className="reminders-back" type="button" disabled={busy} onClick={() => { setSelected(null); setDeleteTarget(null); }}>‹ Alla listor</button>
              <div className="reminders-category">{selected.category === "Övrigt" ? "" : `${categoryEmoji[selected.category]} ${categoryLabel(selected.category)}`}</div>
              <h2>{selected.name}</h2>
              <p className="reminders-progress">{selected.items.filter(item => !item.completed).length} kvar · {selected.items.filter(item => item.completed).length} klara</p>
            </div>
            <details className="reminders-settings" key={selected.id}>
              <summary>Listinställningar</summary>
              <form className="family-admin-form" onSubmit={event => renameList(event, selected)}>
                <label className="family-admin-field"><span>Listans namn</span><input style={typedText} value={listName} onChange={event => setListName(event.target.value)} disabled={busy} /></label>
                <button className="secondary" disabled={busy || !listName.trim() || listName.trim() === selected.name}>Spara namn</button>
              </form>
              <div className="family-admin-form">
                <label className="family-admin-field"><span>Byt kategori</span><select value={selected.category === "Övrigt" ? "" : selected.category} onChange={event => changeCategory(selected, event.target.value as Category)} disabled={busy}><option value="" disabled>Välj kategori</option>{categoryOptions()}</select></label>
                {member?.role === "admin" && <button className="secondary" type="button" onClick={() => setDeleteTarget({ listId: selected.id })} disabled={busy}>Ta bort listan</button>}
              </div>
            </details>
            {member?.role === "admin" && deleteTarget?.listId === selected.id && !deleteTarget.itemId && <div className="reminders-notice">{confirmRemoval(`Ta bort listan ”${selected.name}” och alla dess punkter?`, () => removeList(selected))}</div>}
            <div className="reminders-items">
              {!selected.items.length && <p className="reminders-empty">Listan är tom. Lägg till första punkten nedan.</p>}
              {selected.items.map(entry => (
                <div className="reminders-item" key={entry.id} data-completed={entry.completed}>
                  <button className="reminders-check" role="checkbox" aria-checked={entry.completed} aria-label={`Bocka av ${entry.text}`} onClick={() => toggle(entry)} disabled={busy} type="button">
                    {entry.completed && <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <div className="reminders-item-text">
                    <div className="reminders-item-title"><span className="reminders-star" aria-hidden="true">*</span><strong>{entry.text}</strong></div>
                    <p className="reminders-attribution">
                      <span>Önskad av {familyMembers.find(person => person.id === entry.created_by_member_id)?.display_name ?? "okänd medlem"}</span>
                      {entry.completed && <span>Klar av {familyMembers.find(person => person.id === entry.completed_by_member_id)?.display_name ?? "okänd medlem"}</span>}
                    </p>
                  </div>
                  <button className="reminders-delete" aria-label={`Ta bort ${entry.text}`} title="Ta bort" type="button" onClick={() => setDeleteTarget({ listId: selected.id, itemId: entry.id })} disabled={busy}>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {deleteTarget?.listId === selected.id && deleteTarget.itemId === entry.id && confirmRemoval(`Ta bort ”${entry.text}”?`, () => removeItem(selected, entry))}
                </div>
              ))}
            </div>
            <form className="family-admin-form reminders-add-item" onSubmit={addItem}>
              <input aria-label="Ny listpunkt" value={item} onChange={event => { setItem(event.target.value); if (selected) itemDrafts.current[selected.id] = event.target.value; }} placeholder="Ny punkt" disabled={busy} />
              <button className="primary" disabled={busy || !item.trim()} aria-label="Lägg till listpunkt">＋ Lägg till</button>
            </form>
          </> : <div className="reminders-empty"><h2>Vad planerar familjen?</h2><p>Välj en lista till vänster för att se och lägga till punkter.</p></div>}
        </section>
      </div>
    </main>
  );
}
