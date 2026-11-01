"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FamilyMember = { id: string; display_name: string };
type CalendarEvent = {
  id: string; title: string; description: string | null; location: string | null;
  starts_at: string; ends_at: string | null; all_day: boolean;
  responsible_member_id: string | null; category: string;
};

const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const categories = ["familj", "skola", "träning", "annat"];

function monthLabel(date: Date) { return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(date); }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function monthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = (first.getDay() + 6) % 7;
  const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const cells: Date[] = [];
  for (let i = 0; i < start; i++) cells.push(new Date(date.getFullYear(), date.getMonth(), i - start + 1));
  for (let day = 1; day <= total; day++) cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(new Date(date.getFullYear(), date.getMonth() + 1, cells.length - total - start + 1));
  return cells;
}
function timeLabel(value: string) { return new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formValues(event?: CalendarEvent, date?: Date) {
  const target = event ? new Date(event.starts_at) : (date ?? new Date());
  return {
    title: event?.title ?? "", date: dateKey(target), time: event ? `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}` : "18:00",
    location: event?.location ?? "", description: event?.description ?? "", category: event?.category ?? "familj", responsible_member_id: event?.responsible_member_id ?? ""
  };
}

export default function CalendarPage() {
  const supabase = useMemo(() => createClient(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => formValues());

  async function loadCalendar() {
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: membership, error: membershipError } = await supabase.from("family_members").select("family_id").eq("user_id", auth.user.id).limit(1).single();
    if (membershipError || !membership) { setError("Kunde inte hitta familjen för ditt konto."); return; }
    setFamilyId(membership.family_id);
    const [eventResult, memberResult] = await Promise.all([
      supabase.from("calendar_events").select("id,title,description,location,starts_at,ends_at,all_day,responsible_member_id,category").eq("family_id", membership.family_id).order("starts_at", { ascending: true }),
      supabase.from("family_members").select("id,display_name").eq("family_id", membership.family_id).order("display_name", { ascending: true }),
    ]);
    if (eventResult.error) setError(eventResult.error.message); else setEvents((eventResult.data ?? []) as CalendarEvent[]);
    if (!memberResult.error) setMembers((memberResult.data ?? []) as FamilyMember[]);
  }

  useEffect(() => { void loadCalendar(); }, []);
  const cells = monthDays(currentMonth);
  const eventMap = new Map<string, CalendarEvent[]>();
  events.forEach((event) => { const key = dateKey(new Date(event.starts_at)); const list = eventMap.get(key) ?? []; list.push(event); eventMap.set(key, list); });

  function openAdd(date?: Date) {
    setEditingEvent(null); setForm(formValues(undefined, date)); setError(""); setShowForm(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditingEvent(event); setForm(formValues(event)); setError(""); setShowForm(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault(); if (!familyId || !form.title.trim()) return;
    setSaving(true); setError("");
    const startsAt = new Date(`${form.date}T${form.time}:00`).toISOString();
    const payload = { title: form.title.trim(), description: form.description.trim() || null, location: form.location.trim() || null, starts_at: startsAt, responsible_member_id: form.responsible_member_id || null, category: form.category };
    const result = editingEvent
      ? await supabase.from("calendar_events").update(payload).eq("id", editingEvent.id).eq("family_id", familyId)
      : await supabase.from("calendar_events").insert({ ...payload, family_id: familyId });
    if (result.error) setError(result.error.message); else { setShowForm(false); setEditingEvent(null); await loadCalendar(); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editingEvent || !familyId) return;
    if (!window.confirm(`Ta bort "${editingEvent.title}" från kalendern?`)) return;
    setDeleting(true); setError("");
    const { error: deleteError } = await supabase.from("calendar_events").delete().eq("id", editingEvent.id).eq("family_id", familyId);
    if (deleteError) setError(deleteError.message); else { setShowForm(false); setEditingEvent(null); await loadCalendar(); }
    setDeleting(false);
  }

  const todayKey = dateKey(new Date());
  return (
    <main className="section-shell">
      <header className="section-header"><Link className="back-link" href="/">← Hem</Link><div><p className="eyebrow">KALENDER</p><h1>Familjens kalender</h1></div><button className="primary" type="button" onClick={() => openAdd()}>+ Lägg till</button></header>
      <section className="calendar-card">
        <div className="calendar-toolbar"><div className="calendar-navigation"><button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>‹</button><button type="button" onClick={() => setCurrentMonth(new Date())}>Idag</button><button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>›</button></div><h2>{monthLabel(currentMonth)}</h2></div>
        <div className="calendar-weekdays">{weekdays.map((day) => <div key={day}>{day}</div>)}</div>
        <div className="calendar-grid">{cells.map((day) => { const key = dateKey(day); const dayEvents = eventMap.get(key) ?? []; const outside = day.getMonth() !== currentMonth.getMonth(); return <div key={key} className={`calendar-day ${outside ? "outside" : ""} ${key === todayKey ? "today" : ""}`}><button type="button" className="calendar-day-surface" onClick={() => openAdd(day)} aria-label={`Lägg till aktivitet ${key}`}><span className="calendar-day-number">{day.getDate()}</span></button><span className="calendar-events">{dayEvents.slice(0, 3).map((item) => <button type="button" className={`calendar-event-pill category-${item.category}`} key={item.id} onClick={() => openEdit(item)}>{item.all_day ? "" : `${timeLabel(item.starts_at)} `}{item.title}</button>)}{dayEvents.length > 3 && <span className="calendar-more">+ {dayEvents.length - 3} till</span>}</span></div>; })}</div>
      </section>
      {showForm && <div className="calendar-modal-backdrop" role="presentation"><form className="calendar-modal" onSubmit={handleSave}><div className="calendar-modal-heading"><div><p className="eyebrow">{editingEvent ? "AKTIVITET" : "NY AKTIVITET"}</p><h2>{editingEvent ? "Redigera aktivitet" : "Lägg till i kalendern"}</h2></div><button type="button" onClick={() => { setShowForm(false); setEditingEvent(null); }}>×</button></div>{error && <p className="family-admin-error">{error}</p>}<label className="calendar-field"><span>Titel</span><input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="T.ex. Fotbollsträning" /></label><div className="calendar-form-row"><label className="calendar-field"><span>Datum</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label className="calendar-field"><span>Tid</span><input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label></div><label className="calendar-field"><span>Plats</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="T.ex. Kista IP" /></label><label className="calendar-field"><span>Beskrivning</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Valfri information" rows={3} /></label><div className="calendar-form-row"><label className="calendar-field"><span>Kategori</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label><label className="calendar-field"><span>Ansvarig</span><select value={form.responsible_member_id} onChange={(e) => setForm({ ...form, responsible_member_id: e.target.value })}><option value="">Ingen vald</option>{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label></div><div className="calendar-modal-actions">{editingEvent && <button className="secondary" type="button" onClick={handleDelete} disabled={deleting || saving}>{deleting ? "Tar bort..." : "Ta bort"}</button>}<span className="calendar-modal-spacer" /><button className="secondary" type="button" onClick={() => { setShowForm(false); setEditingEvent(null); }}>Avbryt</button><button className="primary" type="submit" disabled={saving || deleting}>{saving ? "Sparar..." : "Spara aktivitet"}</button></div></form></div>}
    </main>
  );
}
