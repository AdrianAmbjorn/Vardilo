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

export default function CalendarPage() {
  const supabase = useMemo(() => createClient(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", date: dateKey(new Date()), time: "18:00", location: "", category: "familj", responsible_member_id: "" });

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
    const target = date ?? new Date();
    setForm({ title: "", date: dateKey(target), time: "18:00", location: "", category: "familj", responsible_member_id: "" });
    setError(""); setShowForm(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault(); if (!familyId || !form.title.trim()) return;
    setSaving(true); setError("");
    const startsAt = new Date(`${form.date}T${form.time}:00`).toISOString();
    const { error: insertError } = await supabase.from("calendar_events").insert({ family_id: familyId, title: form.title.trim(), location: form.location.trim() || null, starts_at: startsAt, responsible_member_id: form.responsible_member_id || null, category: form.category });
    if (insertError) setError(insertError.message); else { setShowForm(false); await loadCalendar(); }
    setSaving(false);
  }

  const todayKey = dateKey(new Date());
  return (
    <main className="section-shell">
      <header className="section-header"><Link className="back-link" href="/">← Hem</Link><div><p className="eyebrow">KALENDER</p><h1>Familjens kalender</h1></div><button className="primary" type="button" onClick={() => openAdd()}>+ Lägg till</button></header>
      <section className="calendar-card">
        <div className="calendar-toolbar"><div className="calendar-navigation"><button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>‹</button><button type="button" onClick={() => setCurrentMonth(new Date())}>Idag</button><button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>›</button></div><h2>{monthLabel(currentMonth)}</h2></div>
        <div className="calendar-weekdays">{weekdays.map((day) => <div key={day}>{day}</div>)}</div>
        <div className="calendar-grid">{cells.map((day) => { const key = dateKey(day); const dayEvents = eventMap.get(key) ?? []; const outside = day.getMonth() !== currentMonth.getMonth(); return <button key={key} type="button" className={`calendar-day ${outside ? "outside" : ""} ${key === todayKey ? "today" : ""}`} onClick={() => openAdd(day)}><span className="calendar-day-number">{day.getDate()}</span><span className="calendar-events">{dayEvents.slice(0, 3).map((item) => <span className={`calendar-event-pill category-${item.category}`} key={item.id}>{item.all_day ? "" : `${timeLabel(item.starts_at)} `}{item.title}</span>)}{dayEvents.length > 3 && <span className="calendar-more">+ {dayEvents.length - 3} till</span>}</span></button>; })}</div>
      </section>
      {showForm && <div className="calendar-modal-backdrop" role="presentation"><form className="calendar-modal" onSubmit={handleSave}><div className="calendar-modal-heading"><div><p className="eyebrow">NY AKTIVITET</p><h2>Lägg till i kalendern</h2></div><button type="button" onClick={() => setShowForm(false)}>×</button></div>{error && <p className="family-admin-error">{error}</p>}<label className="calendar-field"><span>Titel</span><input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="T.ex. Fotbollsträning" /></label><div className="calendar-form-row"><label className="calendar-field"><span>Datum</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label className="calendar-field"><span>Tid</span><input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label></div><label className="calendar-field"><span>Plats</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="T.ex. Kista IP" /></label><div className="calendar-form-row"><label className="calendar-field"><span>Kategori</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label><label className="calendar-field"><span>Ansvarig</span><select value={form.responsible_member_id} onChange={(e) => setForm({ ...form, responsible_member_id: e.target.value })}><option value="">Ingen vald</option>{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label></div><div className="calendar-modal-actions"><button className="secondary" type="button" onClick={() => setShowForm(false)}>Avbryt</button><button className="primary" type="submit" disabled={saving}>{saving ? "Sparar..." : "Spara aktivitet"}</button></div></form></div>}
    </main>
  );
}
