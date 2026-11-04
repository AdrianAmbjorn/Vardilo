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
type ListItem = { id: string; text: string; completed: boolean };
type OpenList = FamilyList & { items: ListItem[] };
type Member = { id: string; family_id: string; userId: string };

const typedText = { color: "#102a43", WebkitTextFillColor: "#102a43", caretColor: "#102a43" };

export default function ListsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<Member | null>(null);
  const [lists, setLists] = useState<FamilyList[]>([]);
  const [selected, setSelected] = useState<OpenList | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [item, setItem] = useState("");
  const [listName, setListName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const operation = useRef(false);

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
        .select("id,family_id").eq("user_id", auth.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        setLoadError("Ditt konto behöver vara kopplat till en familj för att visa listor.");
        return;
      }
      const { data, error } = await supabase.from("family_lists")
        .select("id,name,category").eq("family_id", profile.family_id).order("created_at");
      if (error) throw error;
      setMember({ ...profile, userId: auth.user.id });
      setLists(data ?? []);
    } catch {
      setLoadError("Kunde inte hämta familjens listor.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

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
      setName("");
      setCategory("");
    }, "Kunde inte skapa listan. Försök igen.");
  }

  function open(list: FamilyList) {
    void run(async () => {
      const { data, error } = await supabase.from("family_list_items")
        .select("id,text,completed").eq("list_id", list.id).order("created_at");
      if (error) throw error;
      setSelected({ ...list, items: data ?? [] });
      setListName(list.name);
      if (selected?.id !== list.id) setItem("");
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
        .select("id,text,completed").single();
      if (error) throw error;
      setSelected({ ...selected, items: [...selected.items, data] });
      setItem("");
    }, "Kunde inte lägga till listpunkten. Försök igen.");
  }

  function removeList(list: OpenList) {
    if (!member || !window.confirm(`Ta bort listan ”${list.name}” och alla dess punkter permanent?`)) return;
    void run(async () => {
      const { error } = await supabase.from("family_lists").delete()
        .eq("id", list.id).eq("family_id", member.family_id).select("id").single();
      if (error) throw error;
      setLists(current => current.filter(entry => entry.id !== list.id));
      setSelected(null);
      setItem("");
    }, "Kunde inte ta bort listan. Försök igen.");
  }

  function removeItem(list: OpenList, entry: ListItem) {
    if (!window.confirm(`Ta bort ”${entry.text}” permanent?`)) return;
    void run(async () => {
      const { error } = await supabase.from("family_list_items").delete()
        .eq("id", entry.id).eq("list_id", list.id).select("id").single();
      if (error) throw error;
      setSelected({ ...list, items: list.items.filter(item => item.id !== entry.id) });
    }, "Kunde inte ta bort listpunkten. Försök igen.");
  }

  function toggle(entry: ListItem) {
    if (!selected) return;
    void run(async () => {
      const { data, error } = await supabase.from("family_list_items")
        .update({ completed: !entry.completed }).eq("id", entry.id).eq("list_id", selected.id)
        .select("id,text,completed").single();
      if (error) throw error;
      setSelected({ ...selected, items: selected.items.map(item => item.id === data.id ? data : item) });
    }, "Kunde inte ändra listpunkten. Försök igen.");
  }

  return (
    <main className="section-shell">
      <header className="section-header">
        <div>
          <p className="eyebrow">VARDILO</p>
          <h1>Listor</h1>
          <p className="muted">Gemensamma listor för familjen.</p>
        </div>
        <Link className="secondary" href="/">Hem</Link>
      </header>
      <section className="section-card">
        {loading && <div className="section-row"><p role="status">Laddar listor...</p></div>}
        {loadError && (
          <div className="section-row">
            <p role="alert">{loadError}</p>
            <button className="secondary" onClick={() => void load()}>Försök igen</button>
          </div>
        )}
        {member && (
          <form className="family-admin-form" onSubmit={addList}>
            <label className="family-admin-field">
              <span>Ny lista</span>
              <input style={typedText} value={name} onChange={event => setName(event.target.value)} placeholder="T.ex. Matbutiken" disabled={busy} />
            </label>
            <label className="family-admin-field">
              <span>Kategori</span>
              <select style={typedText} value={category} onChange={event => setCategory(event.target.value as Category | "")} disabled={busy} required>
                <option value="" disabled>Välj kategori</option>
                {categoryOptions()}
              </select>
            </label>
            <button className="primary" disabled={busy || !name.trim() || !category}>+ Skapa lista</button>
          </form>
        )}
        {error && <div className="section-row"><p role="alert">{error}</p></div>}
        {([...categories, "Övrigt"] as const).map(group => {
          const groupLists = lists.filter(list => list.category === group);
          if (!groupLists.length) return null;
          return (
            <section key={group} aria-label={group === "Övrigt" ? "Listor utan kategori" : categoryLabel(group)}>
              {group !== "Övrigt" && <div className="card-heading"><h2><span aria-hidden="true">{categoryEmoji[group]}</span> {categoryLabel(group)}</h2></div>}
              {groupLists.map(list => (
                <div className="section-row" key={list.id}>
                  <button className="secondary" aria-expanded={selected?.id === list.id} onClick={() => open(list)} disabled={busy}>{list.name}</button>
                </div>
              ))}
            </section>
          );
        })}
        {selected && (
          <div style={{ marginTop: 24 }}>
            <div className="card-heading"><h3>{selected.name}</h3></div>
            <form className="family-admin-form" onSubmit={event => renameList(event, selected)}>
              <label className="family-admin-field">
                <span>Listans namn</span>
                <input style={typedText} value={listName} onChange={event => setListName(event.target.value)} disabled={busy} />
              </label>
              <button className="secondary" disabled={busy || !listName.trim() || listName.trim() === selected.name}>
                Spara namn
              </button>
            </form>
            <div className="family-admin-form">
              <label className="family-admin-field">
                <span>Byt kategori</span>
                <select style={typedText} value={selected.category === "Övrigt" ? "" : selected.category} onChange={event => changeCategory(selected, event.target.value as Category)} disabled={busy}>
                  <option value="" disabled>Välj kategori</option>
                  {categoryOptions()}
                </select>
              </label>
              <button className="secondary" onClick={() => removeList(selected)} disabled={busy}>
                Ta bort listan
              </button>
            </div>
            <form className="family-admin-form" onSubmit={addItem}>
              <input aria-label="Ny listpunkt" style={typedText} value={item} onChange={event => setItem(event.target.value)} placeholder="Lägg till listpunkt" disabled={busy} />
              <button className="primary" disabled={busy || !item.trim()}>+ Lägg till</button>
            </form>
            {!selected.items.length && <div className="section-row"><p className="muted">Listan är tom.</p></div>}
            {selected.items.map(entry => (
              <div className="task-row" key={entry.id}>
                <span aria-hidden="true" style={{ color: "var(--muted)", flexShrink: 0 }}>*</span>
                <input
                  type="checkbox"
                  aria-label={`Bocka av ${entry.text}`}
                  checked={entry.completed}
                  onChange={() => toggle(entry)}
                  disabled={busy}
                  style={{ accentColor: "#334155", width: 18, height: 18, margin: 0, flexShrink: 0 }}
                />
                <strong style={{ ...typedText, textDecoration: entry.completed ? "line-through" : "none" }}>{entry.text}</strong>
                <button
                  className="secondary"
                  aria-label={`Ta bort ${entry.text}`}
                  onClick={() => removeItem(selected, entry)}
                  disabled={busy}
                  style={{ marginLeft: "auto" }}
                >
                  Ta bort
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
