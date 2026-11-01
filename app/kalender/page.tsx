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
type CalendarBreak = { id: string; title: string; break_type: string; starts_on: string; ends_on: string };

const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const categories = ["familj", "skola", "träning", "annat"];
const breakTypes = ["lov", "studiedag", "annat"];

function monthLabel(date: Date) { return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(date); }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function monthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1); const start = (first.getDay() + 6) % 7;
  const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); const cells: Date[] = [];
  for (let i = 0; i < start; i++) cells.push(new Date(date.getFullYear(), date.getMonth(), i - start + 1));
  for (let day = 1; day <= total; day++) cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(new Date(date.getFullYear(), date.getMonth() + 1, cells.length - total - start + 1));
  return cells;
}
function weekDays(date: Date) {
  const day = new Date(date); const mondayOffset = (day.getDay() + 6) % 7; day.setDate(day.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(day); d.setDate(day.getDate() + i); return d; });
}
function timeLabel(value: string) { return new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formValues(event?: CalendarEvent, date?: Date) {
  const target = event ? new Date(event.starts_at) : (date ?? new Date());
  return { title: event?.title ?? "", date: dateKey(target), time: event ? `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}` : "18:00", location: event?.location ?? "", description: event?.description ?? "", category: event?.category ?? "familj", responsible_member_id: event?.responsible_member_id ?? "" };
}

export default function CalendarPage() {
  const supabase = useMemo(() => createClient(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [breaks, setBreaks] = useState<CalendarBreak[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBreakForm, setShowBreakForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBreak, setSavingBreak] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => formValues());
  const [breakForm, setBreakForm] = useState({ title: "", break_type: "lov", starts_on: dateKey(new Date()), ends_on: dateKey(new Date()) });

  async function loadCalendar() {
    setError("");
    const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return;
    const { data: membership, error: membershipError } = await supabase.from("family_members").select("family_id").eq("user_id", auth.user.id).limit(1).single();
    if (membershipError || !membership) { setError("Kunde inte hitta familjen för ditt konto."); return; }
    setFamilyId(membership.family_id);
    const [eventResult, memberResult, breakResult] = await Promise.all([
      supabase.from("calendar_events").select("id,title,description,location,starts_at,ends_at,all_day,responsible_member_id,category").eq("family_id", membership.family_id).order("starts_at", { ascending: true }),
      supabase.from("family_members").select("id,display_name").eq("family_id", membership.family_id).order("display_name", { ascending: true }),
      supabase.from("calendar_breaks").select("id,title,break_type,starts_on,ends_on").eq("family_id", membership.family_id).order("starts_on", { ascending: true }),
    ]);
    if (eventResult.error) setError(eventResult.error.message); else setEvents((eventResult.data ?? []) as CalendarEvent[]);
    if (!memberResult.error) setMembers((memberResult.data ?? []) as FamilyMember[]);
    if (!breakResult.error) setBreaks((breakResult.data ?? []) as CalendarBreak[]);
  }

  useEffect(() => { void loadCalendar(); }, []);
  const cells = monthDays(currentMonth); const currentWeek = weekDays(currentMonth);
  const eventMap = new Map<string, CalendarEvent[]>();
  events.forEach((event) => { const key = dateKey(new Date(event.starts_at)); const list = eventMap.get(key) ?? []; list.push(event); eventMap.set(key, list); });
  const breaksForDate = (date: Date) => breaks.filter((item) => dateKey(date) >= item.starts_on && dateKey(date) <= item.ends_on);

  function openAdd(date?: Date) { setEditingEvent(null); setForm(formValues(undefined, date)); setError(""); setShowForm(true); }
  function openEdit(event: CalendarEvent) { setEditingEvent(event); setForm(formValues(event)); setError(""); setShowForm(true); }
  function openBreakForm(date?: Date) { const key = dateKey(date ?? new Date()); setBreakForm({ title: "", break_type: "lov", starts_on: key, ends_on: key }); setError(""); setShowBreakForm(true); }
  function movePeriod(direction: number) { if (view === "month") setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1)); else { const next = new Date(currentMonth); next.setDate(next.getDate() + direction * 7); setCurrentMonth(next); } }
  function goToday() { setCurrentMonth(new Date()); }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault(); if (!familyId || !form.title.trim()) return; setSaving(true); setError("");
    const startsAt = new Date(`${form.date}T${form.time}:00`).toISOString();
    const payload = { title: form.title.trim(), description: form.description.trim() || null, location: form.location.trim() || null, starts_at: startsAt, responsible_member_id: form.responsible_member_id || null, category: form.category };
    const result = editingEvent ? await supabase.from("calendar_events").update(payload).eq("id", editingEvent.id).eq("family_id", familyId) : await supabase.from("calendar_events").insert({ ...payload, family_id: familyId });
    if (result.error) setError(result.error.message); else { setShowForm(false); setEditingEvent(null); await loadCalendar(); } setSaving(false);
  }
  async function handleDelete() {
    if (!editingEvent || !familyId) return; if (!window.confirm(`Ta bort "${editingEvent.title}" från kalendern?`)) return;
    setDeleting(true); setError(""); const { error: deleteError } = await supabase.from("calendar_events").delete().eq("id", editingEvent.id).eq("family_id", familyId);
    if (deleteError) setError(deleteError.message); else { setShowForm(false); setEditingEvent(null); await loadCalendar(); } setDeleting(false);
  }
  async function handleSaveBreak(event: React.FormEvent) {
    event.preventDefault(); if (!familyId || !breakForm.title.trim()) return;
    if (breakForm.ends_on < breakForm.starts_on) { setError("Slutdatum kan inte vara före startdatum."); return; }
    setSavingBreak(true); setError("");
    const { error: saveError } = await supabase.from("calendar_breaks").insert({ family_id: familyId, title: breakForm.title.trim(), break_type: breakForm.break_type, starts_on: breakForm.starts_on, ends_on: breakForm.ends_on });
    if (saveError) setError(saveError.message); else { setShowBreakForm(false); await loadCalendar(); }
    setSavingBreak(false);
  }

  const todayKey = dateKey(new Date());
  const switchButtonStyle = (active: boolean): React.CSSProperties => ({ border: active ? "1px solid #0b2d4d" : "1px solid #dbe3ea", background: active ? "#0b2d4d" : "#ffffff", color: active ? "#ffffff" : "#102a43", borderRadius: 9, padding: "8px 12px", minWidth: 70, fontSize: 12, fontWeight: 700, cursor: "pointer" });
  const breakButtonStyle: React.CSSProperties = { border: "1px solid #c62828", background: "#ffffff", color: "#c62828", borderRadius: 9, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
  const weekGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", width: "100%" };
  const weekDayStyle: React.CSSProperties = { minWidth: 0, minHeight: 360, padding: 10, borderRight: "1px solid #dbe3ea", borderBottom: "1px solid #dbe3ea", background: "#ffffff", verticalAlign: "top", overflow: "hidden" };

  return <main className="section-shell">
    <header className="section-header"><Link className="back-link" href="/">← Hem</Link><div><p className="eyebrow">KALENDER</p><h1>Familjens kalender</h1></div><div style={{ display: "flex", gap: 8 }}><button style={breakButtonStyle} type="button" onClick={() => openBreakForm()}>Lov & studiedagar</button><button className="primary" type="button" onClick={() => openAdd()}>+ Lägg till</button></div></header>
    <section className="calendar-card">
      <div className="calendar-toolbar" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14 }}>
        <div className="calendar-navigation"><button type="button" onClick={() => movePeriod(-1)}>‹</button><button type="button" onClick={goToday}>Idag</button><button type="button" onClick={() => movePeriod(1)}>›</button></div>
        <h2 style={{ margin: 0, color: "#102a43", fontSize: 20, lineHeight: 1.2, textAlign: "center", minWidth: 180, whiteSpace: "nowrap" }}>{view === "month" ? monthLabel(currentMonth) : `${currentWeek[0].getDate()}–${currentWeek[6].getDate()} ${new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(currentWeek[6])}`}</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center", justifySelf: "end" }}><button type="button" style={switchButtonStyle(view === "month")} onClick={() => setView("month")}>Månad</button><button type="button" style={switchButtonStyle(view === "week")} onClick={() => setView("week")}>Vecka</button></div>
      </div>
      {view === "month" ? <><div className="calendar-weekdays">{weekdays.map((day) => <div key={day}>{day}</div>)}</div><div className="calendar-grid">{cells.map((day) => { const key = dateKey(day); const dayEvents = eventMap.get(key) ?? []; const dayBreaks = breaksForDate(day); const outside = day.getMonth() !== currentMonth.getMonth(); return <div key={key} className={`calendar-day ${outside ? "outside" : ""} ${key === todayKey ? "today" : ""}`}><button type="button" className="calendar-day-surface" onClick={() => openAdd(day)} aria-label={`Lägg till aktivitet ${key}`}><span className="calendar-day-number">{day.getDate()}</span></button>{dayBreaks.map((item) => <button key={item.id} type="button" onClick={() => openBreakForm(day)} style={{ display: "block", width: "100%", border: 0, borderRadius: 5, background: "#fbeaea", color: "#c62828", padding: "4px 5px", marginBottom: 4, fontSize: 9, fontWeight: 800, textAlign: "left", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.break_type === "studiedag" ? "Studiedag" : item.title}</button>)}<span className="calendar-events">{dayEvents.slice(0, 3).map((item) => <button type="button" className={`calendar-event-pill category-${item.category}`} key={item.id} onClick={() => openEdit(item)}>{item.all_day ? "" : `${timeLabel(item.starts_at)} `}{item.title}</button>)}{dayEvents.length > 3 && <span className="calendar-more">+ {dayEvents.length - 3} till</span>}</span></div>; })}</div></> : <><div className="calendar-weekdays">{currentWeek.map((day, i) => <div key={dateKey(day)}>{weekdays[i]} {day.getDate()}</div>)}</div><div className="calendar-week-grid" style={weekGridStyle}>{currentWeek.map((day, index) => { const key = dateKey(day); const dayEvents = eventMap.get(key) ?? []; const dayBreaks = breaksForDate(day); return <div key={key} className={`calendar-week-day ${key === todayKey ? "today" : ""}`} style={{ ...weekDayStyle, ...(index === 6 ? { borderRight: 0 } : {}) }}><button type="button" className="calendar-day-surface" onClick={() => openAdd(day)}><span className="calendar-day-number">{day.getDate()}</span></button>{dayBreaks.map((item) => <button key={item.id} type="button" onClick={() => openBreakForm(day)} style={{ display: "block", width: "100%", border: 0, borderRadius: 5, background: "#fbeaea", color: "#c62828", padding: "5px 6px", marginBottom: 6, fontSize: 9, fontWeight: 800, textAlign: "left", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.break_type === "studiedag" ? "Studiedag" : item.title}</button>)}<span className="calendar-events">{dayEvents.map((item) => <button type="button" className={`calendar-event-pill category-${item.category}`} key={item.id} onClick={() => openEdit(item)}>{item.all_day ? "" : `${timeLabel(item.starts_at)} `}{item.title}</button>)}</span></div>; })}</div></>}
    </section>
    {showForm && <div className="calendar-modal-backdrop" role="presentation"><form className="calendar-modal" onSubmit={handleSave}><div className="calendar-modal-heading"><div><p className="eyebrow">{editingEvent ? "AKTIVITET" : "NY AKTIVITET"}</p><h2>{editingEvent ? "Redigera aktivitet" : "Lägg till i kalendern"}</h2></div><button type="button" onClick={() => { setShowForm(false); setEditingEvent(null); }}>×</button></div>{error && <p className="family-admin-error">{error}</p>}<label className="calendar-field"><span>Titel</span><input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="T.ex. Fotbollsträning" /></label><div className="calendar-form-row"><label className="calendar-field"><span>Datum</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label className="calendar-field"><span>Tid</span><input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label></div><label className="calendar-field"><span>Plats</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="T.ex. Kista IP" /></label><label className="calendar-field"><span>Beskrivning</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Valfri information" rows={3} /></label><div className="calendar-form-row"><label className="calendar-field"><span>Kategori</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label><label className="calendar-field"><span>Ansvarig</span><select value={form.responsible_member_id} onChange={(e) => setForm({ ...form, responsible_member_id: e.target.value })}><option value="">Ingen vald</option>{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label></div><div className="calendar-modal-actions">{editingEvent && <button className="secondary" type="button" onClick={handleDelete} disabled={deleting || saving}>{deleting ? "Tar bort..." : "Ta bort"}</button>}<span className="calendar-modal-spacer" /><button className="secondary" type="button" onClick={() => { setShowForm(false); setEditingEvent(null); }}>Avbryt</button><button className="primary" type="submit" disabled={saving || deleting}>{saving ? "Sparar..." : "Spara aktivitet"}</button></div></form></div>}
    {showBreakForm && <div className="calendar-modal-backdrop" role="presentation"><form className="calendar-modal" onSubmit={handleSaveBreak}><div className="calendar-modal-heading"><div><p className="eyebrow">LOV & STUDIEDAGAR</p><h2>Markera ledighet</h2></div><button type="button" onClick={() => setShowBreakForm(false)}>×</button></div>{error && <p className="family-admin-error">{error}</p>}<p className="muted" style={{ marginBottom: 16 }}>Markera en hel vecka eller flera dagar på en gång. Detta blir en tydlig markering i familjens kalender.</p><label className="calendar-field"><span>Namn</span><input autoFocus required value={breakForm.title} onChange={(e) => setBreakForm({ ...breakForm, title: e.target.value })} placeholder="T.ex. Höstlov" /></label><label className="calendar-field"><span>Typ</span><select value={breakForm.break_type} onChange={(e) => setBreakForm({ ...breakForm, break_type: e.target.value })}>{breakTypes.map((type) => <option key={type} value={type}>{type === "lov" ? "Lov" : type === "studiedag" ? "Studiedag" : "Annat"}</option>)}</select></label><div className="calendar-form-row"><label className="calendar-field"><span>Från</span><input type="date" required value={breakForm.starts_on} onChange={(e) => setBreakForm({ ...breakForm, starts_on: e.target.value })} /></label><label className="calendar-field"><span>Till</span><input type="date" required value={breakForm.ends_on} onChange={(e) => setBreakForm({ ...breakForm, ends_on: e.target.value })} /></label></div><div className="calendar-modal-actions"><span className="calendar-modal-spacer" /><button className="secondary" type="button" onClick={() => setShowBreakForm(false)}>Avbryt</button><button className="primary" type="submit" disabled={savingBreak}>{savingBreak ? "Sparar..." : "Spara ledighet"}</button></div></form></div>}
  </main>;
}
