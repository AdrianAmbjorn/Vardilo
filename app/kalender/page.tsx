"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calendarImportId, parseCalendarFile } from "@/lib/calendar-import";
import { createClient } from "@/lib/supabase/client";

type FamilyMember = { id: string; display_name: string; color: string };
type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  responsible_member_id: string | null;
  target_member_id: string | null;
  category: string;
  reminder_minutes: number | null;
  assignment_status: "pending" | "accepted" | "declined";
  assigned_at: string | null;
  assignment_responded_at: string | null;
  recurrence_enabled: boolean;
  recurrence_days: number[];
  recurrence_end_date: string | null;
};
type CalendarBreak = { id: string; title: string; break_type: string; starts_on: string; ends_on: string };

const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const categories = ["familj", "skola", "träning", "annat"];
const breakTypes = ["lov", "studiedag", "annat"];
const reminderOptions = [
  { value: "", label: "Ingen påminnelse" },
  { value: "15", label: "15 min före" },
  { value: "30", label: "30 min före" },
  { value: "60", label: "1 timme före" },
  { value: "1440", label: "1 dag före" },
];
const memberColors: Record<string, { background: string; text: string }> = {
  red: { background: "#c62828", text: "#ffffff" },
  yellow: { background: "#f2c94c", text: "#102a43" },
  blue: { background: "#2f6f9f", text: "#ffffff" },
  green: { background: "#3f7d4a", text: "#ffffff" },
  purple: { background: "#7652a8", text: "#ffffff" },
  orange: { background: "#d97828", text: "#ffffff" },
  teal: { background: "#2f8f8f", text: "#ffffff" },
  pink: { background: "#c45a83", text: "#ffffff" },
};

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
function weekDays(date: Date) {
  const day = new Date(date);
  const mondayOffset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(day); d.setDate(day.getDate() + i); return d; });
}
function timeLabel(value: string) { return new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formValues(event?: CalendarEvent, date?: Date) {
  const target = event ? new Date(event.starts_at) : (date ?? new Date());
  return {
    title: event?.title ?? "",
    date: dateKey(target),
    time: event ? `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}` : "18:00",
    location: event?.location ?? "",
    description: event?.description ?? "",
    category: event?.category ?? "familj",
    target_member_id: event?.target_member_id ?? "",
    responsible_member_id: event?.responsible_member_id ?? "",
    reminder_minutes: event?.reminder_minutes == null ? "" : String(event.reminder_minutes),
    recurrence_enabled: event?.recurrence_enabled ?? false,
    recurrence_days: event?.recurrence_days ?? [],
    recurrence_end_date: event?.recurrence_end_date ?? "",
  };
}

export default function CalendarPage() {
  const supabase = useMemo(() => createClient(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [breaks, setBreaks] = useState<CalendarBreak[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBreakForm, setShowBreakForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingBreak, setEditingBreak] = useState<CalendarBreak | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBreak, setSavingBreak] = useState(false);
  const [responding, setResponding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingBreak, setDeletingBreak] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [calendarFile, setCalendarFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => formValues());
  const [breakForm, setBreakForm] = useState({ title: "", break_type: "lov", starts_on: dateKey(new Date()), ends_on: dateKey(new Date()) });

  async function loadCalendar() {
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: membership, error: membershipError } = await supabase.from("family_members").select("id,family_id").eq("user_id", auth.user.id).limit(1).single();
    if (membershipError || !membership) { setError("Kunde inte hitta familjen för ditt konto."); return; }
    setFamilyId(membership.family_id);
    setCurrentMemberId(membership.id);
    const [eventResult, memberResult, breakResult] = await Promise.all([
      supabase.from("calendar_events").select("id,title,description,location,starts_at,ends_at,all_day,responsible_member_id,target_member_id,category,reminder_minutes,assignment_status,assigned_at,assignment_responded_at,recurrence_enabled,recurrence_days,recurrence_end_date").eq("family_id", membership.family_id).order("starts_at", { ascending: true }),
      supabase.from("family_members").select("id,display_name,color").eq("family_id", membership.family_id).order("display_name", { ascending: true }),
      supabase.from("calendar_breaks").select("id,title,break_type,starts_on,ends_on").eq("family_id", membership.family_id).order("starts_on", { ascending: true }),
    ]);
    if (eventResult.error) setError(eventResult.error.message); else setEvents((eventResult.data ?? []) as CalendarEvent[]);
    if (!memberResult.error) setMembers((memberResult.data ?? []) as FamilyMember[]);
    if (!breakResult.error) setBreaks((breakResult.data ?? []) as CalendarBreak[]);
  }

  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("datum");
    if (target) {
      const date = new Date(target);
      if (Number.isFinite(date.getTime())) {
        setCurrentMonth(date);
        setView("week");
      }
    }
    void loadCalendar();
  }, []);
  const cells = monthDays(currentMonth);
  const currentWeek = weekDays(currentMonth);
  const expandedEvents = useMemo(() => {
    const result: CalendarEvent[] = [];
    for (const event of events) {
      if (!event.recurrence_enabled || !event.recurrence_end_date || event.recurrence_days.length === 0) {
        result.push(event);
        continue;
      }
      const start = new Date(event.starts_at);
      const endDate = new Date(`${event.recurrence_end_date}T23:59:59`);
      const cursor = new Date(start);
      let count = 0;
      while (cursor <= endDate && count < 370) {
        const mondayIndex = (cursor.getDay() + 6) % 7;
        if (cursor >= start && event.recurrence_days.includes(mondayIndex)) {
          const occurrence = new Date(cursor);
          occurrence.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
          const duration = event.ends_at ? new Date(event.ends_at).getTime() - start.getTime() : 0;
          result.push({
            ...event,
            id: `${event.id}-${dateKey(occurrence)}`,
            starts_at: occurrence.toISOString(),
            ends_at: duration > 0 ? new Date(occurrence.getTime() + duration).toISOString() : null,
          });
        }
        cursor.setDate(cursor.getDate() + 1);
        count += 1;
      }
    }
    return result;
  }, [events]);
  const eventMap = new Map<string, CalendarEvent[]>();
  for (const day of view === "month" ? cells : currentWeek) {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    const dayEvents = expandedEvents.filter(event => {
      const startsAt = Date.parse(event.starts_at);
      const endsAt = event.ends_at ? Date.parse(event.ends_at) : startsAt;
      return startsAt < nextDay && (startsAt >= dayStart || endsAt > dayStart);
    });
    if (dayEvents.length) eventMap.set(dateKey(day), dayEvents);
  }
  const breaksForDate = (date: Date) => breaks.filter((item) => dateKey(date) >= item.starts_on && dateKey(date) <= item.ends_on);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const eventStyle = (item: CalendarEvent): React.CSSProperties => {
    const target = item.target_member_id ? memberById.get(item.target_member_id) : null;
    const responsible = item.responsible_member_id ? memberById.get(item.responsible_member_id) : null;
    const targetColor = target ? memberColors[target.color] ?? memberColors.blue : { background: "#0b2d4d", text: "#ffffff" };
    const responsibleColor = responsible ? memberColors[responsible.color] ?? memberColors.blue : null;
    return { background: targetColor.background, color: targetColor.text, borderLeft: responsibleColor ? `6px solid ${responsibleColor.background}` : undefined, boxShadow: responsibleColor ? `inset -5px 0 0 ${responsibleColor.background}` : undefined };
  };

  function openAdd(date?: Date) { setEditingEvent(null); setForm(formValues(undefined, date)); setError(""); setShowForm(true); }
  function openEdit(event: CalendarEvent) {
    const original = events.find((item) => event.id.startsWith(`${item.id}-`) || item.id === event.id) ?? event;
    setEditingEvent(original);
    setForm(formValues(original, new Date(event.starts_at)));
    setError(""); setShowForm(true);
  }
  function openBreakForm(date?: Date, item?: CalendarBreak) {
    if (item) { setEditingBreak(item); setBreakForm({ title: item.title, break_type: item.break_type, starts_on: item.starts_on, ends_on: item.ends_on }); }
    else { setEditingBreak(null); const key = dateKey(date ?? new Date()); setBreakForm({ title: "", break_type: "lov", starts_on: key, ends_on: key }); }
    setError(""); setShowBreakForm(true);
  }
  function movePeriod(direction: number) { if (view === "month") setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1)); else { const next = new Date(currentMonth); next.setDate(next.getDate() + direction * 7); setCurrentMonth(next); } }
  function goToday() { setCurrentMonth(new Date()); }

  async function importCalendar(event: React.FormEvent) {
    event.preventDefault();
    if (!calendarFile || !familyId || !currentMemberId || importing) return;
    setImporting(true);
    setImportError("");
    setImportResult("");
    try {
      if (calendarFile.size > 2_000_000) throw new Error("Kalenderfilen får vara högst 2 MB.");
      const { rows, skipped, omittedReminders } = parseCalendarFile(await calendarFile.text());
      if (!rows.length) throw new Error("Filen innehåller inga aktiviteter som kan importeras.");
      if (rows.length > 500) throw new Error("Exportera högst 500 aktiviteter per fil.");
      const payload = await Promise.all([...new Map(rows.map(row => [row.uid, row])).values()].map(async ({ uid, ...row }) => ({
        ...row,
        id: await calendarImportId(familyId, uid),
        family_id: familyId,
        category: "annat",
        responsible_member_id: row.reminder_minutes === null ? null : currentMemberId,
        assignment_status: row.reminder_minutes === null ? "pending" : "accepted",
      })));
      const { data, error } = await supabase.from("calendar_events")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: true }).select("id,starts_at");
      if (error) throw new Error("Kunde inte spara importen. Försök igen.");
      const imported = data?.length ?? 0;
      setImportResult(`Importerade ${imported} aktiviteter. ${rows.length - imported} dubbletter hoppades över. ${skipped} aktiviteter och extra eller osparbara påminnelser för ${omittedReminders} aktiviteter hoppades över.`);
      setShowImport(false);
      setCalendarFile(null);
      await loadCalendar();
      if (data?.length) setCurrentMonth(new Date(data[0].starts_at));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Kunde inte läsa kalenderfilen.");
    } finally {
      setImporting(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!familyId || !form.title.trim()) return;
    if (form.recurrence_enabled && (!form.recurrence_end_date || form.recurrence_days.length === 0)) { setError("Välj minst en veckodag och ett slutdatum för den återkommande aktiviteten."); return; }
    if (form.recurrence_enabled && form.recurrence_end_date < form.date) { setError("Slutdatum kan inte vara före startdatum."); return; }
    setSaving(true); setError("");
    const startsAt = new Date(`${form.date}T${form.time}:00`).toISOString();
    const responsibleChanged = editingEvent ? editingEvent.responsible_member_id !== (form.responsible_member_id || null) : true;
    const payload: Record<string, unknown> = {
      title: form.title.trim(), description: form.description.trim() || null, location: form.location.trim() || null,
      starts_at: startsAt, target_member_id: form.target_member_id || null, responsible_member_id: form.responsible_member_id || null,
      category: form.category, reminder_minutes: form.reminder_minutes ? Number(form.reminder_minutes) : null,
      recurrence_enabled: form.recurrence_enabled, recurrence_days: form.recurrence_enabled ? form.recurrence_days : [], recurrence_end_date: form.recurrence_enabled ? form.recurrence_end_date : null,
    };
    if (responsibleChanged) {
      payload.assignment_status = "pending";
      payload.assigned_at = form.responsible_member_id ? new Date().toISOString() : null;
      payload.assignment_responded_at = null;
    }
    const result = editingEvent
      ? await supabase.from("calendar_events").update(payload).eq("id", editingEvent.id).eq("family_id", familyId)
      : await supabase.from("calendar_events").insert({ ...payload, family_id: familyId, assignment_status: "pending", assigned_at: form.responsible_member_id ? new Date().toISOString() : null });
    if (result.error) setError(result.error.message);
    else { setShowForm(false); setEditingEvent(null); await loadCalendar(); }
    setSaving(false);
  }

  async function respondToAssignment(response: "accepted" | "declined") {
    if (!editingEvent) return;
    setResponding(true); setError("");
    const { error: responseError } = await supabase.rpc("respond_to_calendar_assignment", { target_event_id: editingEvent.id, response });
    if (responseError) setError(responseError.message);
    else { setShowForm(false); setEditingEvent(null); await loadCalendar(); }
    setResponding(false);
  }

  async function handleDelete() {
    if (!editingEvent || !familyId) return;
    if (!window.confirm(`Ta bort "${editingEvent.title}" från kalendern?`)) return;
    setDeleting(true); setError("");
    const { error: deleteError } = await supabase.from("calendar_events").delete().eq("id", editingEvent.id).eq("family_id", familyId);
    if (deleteError) setError(deleteError.message); else { setShowForm(false); setEditingEvent(null); await loadCalendar(); }
    setDeleting(false);
  }

  async function handleSaveBreak(event: React.FormEvent) {
    event.preventDefault();
    if (!familyId || !breakForm.title.trim()) return;
    if (breakForm.ends_on < breakForm.starts_on) { setError("Slutdatum kan inte vara före startdatum."); return; }
    setSavingBreak(true); setError("");
    const payload = { title: breakForm.title.trim(), break_type: breakForm.break_type, starts_on: breakForm.starts_on, ends_on: breakForm.ends_on };
    const result = editingBreak ? await supabase.from("calendar_breaks").update(payload).eq("id", editingBreak.id).eq("family_id", familyId) : await supabase.from("calendar_breaks").insert({ ...payload, family_id: familyId });
    if (result.error) setError(result.error.message); else { setShowBreakForm(false); setEditingBreak(null); await loadCalendar(); }
    setSavingBreak(false);
  }

  async function handleDeleteBreak() {
    if (!editingBreak || !familyId) return;
    if (!window.confirm(`Ta bort "${editingBreak.title}" från kalendern?`)) return;
    setDeletingBreak(true); setError("");
    const { error: deleteError } = await supabase.from("calendar_breaks").delete().eq("id", editingBreak.id).eq("family_id", familyId);
    if (deleteError) setError(deleteError.message); else { setShowBreakForm(false); setEditingBreak(null); await loadCalendar(); }
    setDeletingBreak(false);
  }

  const todayKey = dateKey(new Date());
  const switchButtonStyle = (active: boolean): React.CSSProperties => ({ border: active ? "1px solid #0b2d4d" : "1px solid #dbe3ea", background: active ? "#0b2d4d" : "#ffffff", color: active ? "#ffffff" : "#102a43", borderRadius: 9, padding: "8px 12px", minWidth: 70, fontSize: 12, fontWeight: 700, cursor: "pointer" });
  const breakButtonStyle: React.CSSProperties = { border: "1px solid #c62828", background: "#ffffff", color: "#c62828", borderRadius: 9, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
  const weekGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", width: "100%" };
  const weekDayStyle: React.CSSProperties = { minWidth: 0, minHeight: 360, padding: 10, borderRight: "1px solid #dbe3ea", borderBottom: "1px solid #dbe3ea", background: "#ffffff", overflow: "hidden" };
  const assignmentLabel = (event: CalendarEvent) => event.assignment_status === "accepted" ? "Accepterad" : event.assignment_status === "declined" ? "Avböjd" : "Väntar på acceptans";
  const assignmentIcon = (event: CalendarEvent) => event.assignment_status === "accepted" ? "✓" : "×";
  const assignmentIconStyle = (event: CalendarEvent): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, marginLeft: 5, borderRadius: "50%", background: event.assignment_status === "accepted" ? "#2e7d32" : "#c62828", color: "#ffffff", fontSize: 11, fontWeight: 900, verticalAlign: "middle" });
  const toggleDay = (day: number) => setForm({ ...form, recurrence_days: form.recurrence_days.includes(day) ? form.recurrence_days.filter((item) => item !== day) : [...form.recurrence_days, day].sort((a, b) => a - b) });

  return <main className="section-shell">
    <header className="section-header"><Link className="back-link" href="/">← Hem</Link><div><p className="eyebrow">KALENDER</p><h1>Familjens kalender</h1></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="secondary" type="button" disabled={!familyId} onClick={() => { setImportError(""); setCalendarFile(null); setShowImport(true); }}>Importera kalender</button><button style={breakButtonStyle} type="button" onClick={() => openBreakForm()}>Lov & studiedagar</button><button className="primary" type="button" onClick={() => openAdd()}>+ Lägg till</button></div></header>
    {importResult && <p role="status" className="section-row">{importResult}</p>}
    {showImport && (
      <div className="calendar-modal-backdrop">
        <form className="calendar-modal" onSubmit={importCalendar}>
          <h2>Importera kalender</h2>
          <p>Välj en .ics-fil. Aktiviteterna blir synliga för familjen. Stödda påminnelser kopplas till dig.</p>
          <p className="muted">Importen är en engångskopia. Återkommande aktiviteter hoppas över.</p>
          <label className="calendar-field">
            <span>Kalenderfil (.ics)</span>
            <input type="file" accept=".ics,text/calendar" required disabled={importing} onChange={event => setCalendarFile(event.target.files?.[0] ?? null)} />
          </label>
          {importError && <p role="alert" className="family-admin-error">{importError}</p>}
          <div className="calendar-modal-actions">
            <button type="button" className="secondary" disabled={importing} onClick={() => setShowImport(false)}>Avbryt</button>
            <button type="submit" className="primary" disabled={!calendarFile || importing}>{importing ? "Importerar..." : "Importera"}</button>
          </div>
        </form>
      </div>
    )}
    <section className="calendar-card">
      <div className="calendar-toolbar" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14 }}><div className="calendar-navigation"><button type="button" onClick={() => movePeriod(-1)}>‹</button><button type="button" onClick={goToday}>Idag</button><button type="button" onClick={() => movePeriod(1)}>›</button></div><h2 style={{ margin: 0, color: "#102a43", fontSize: 20, lineHeight: 1.2, textAlign: "center", minWidth: 180, whiteSpace: "nowrap" }}>{view === "month" ? monthLabel(currentMonth) : `${currentWeek[0].getDate()}–${currentWeek[6].getDate()} ${new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(currentWeek[6])}`}</h2><div style={{ display: "flex", gap: 6, alignItems: "center", justifySelf: "end" }}><button type="button" style={switchButtonStyle(view === "month")} onClick={() => setView("month")}>Månad</button><button type="button" style={switchButtonStyle(view === "week")} onClick={() => setView("week")}>Vecka</button></div></div>
      {view === "month" ? <><div className="calendar-weekdays">{weekdays.map((day) => <div key={day}>{day}</div>)}</div><div className="calendar-grid">{cells.map((day) => { const key = dateKey(day); const dayEvents = eventMap.get(key) ?? []; const dayBreaks = breaksForDate(day); const outside = day.getMonth() !== currentMonth.getMonth(); return <div key={key} className={`calendar-day ${outside ? "outside" : ""} ${key === todayKey ? "today" : ""}`}><button type="button" className="calendar-day-surface" onClick={() => openAdd(day)} aria-label={`Lägg till aktivitet ${key}`}><span className="calendar-day-number">{day.getDate()}</span></button>{dayBreaks.map((item) => <button key={item.id} type="button" onClick={() => openBreakForm(undefined, item)} style={{ display: "block", width: "100%", border: 0, borderRadius: 5, background: "#fbeaea", color: "#c62828", padding: "4px 5px", marginBottom: 4, fontSize: 9, fontWeight: 800, textAlign: "left", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.break_type === "studiedag" ? "Studiedag" : item.title}</button>)}<span className="calendar-events">{dayEvents.slice(0, 3).map((item) => <button type="button" className={`calendar-event-pill category-${item.category}`} style={eventStyle(item)} key={item.id} onClick={() => openEdit(item)}>{item.all_day || dateKey(new Date(item.starts_at)) !== key ? "" : `${timeLabel(item.starts_at)} `}{item.title}{item.responsible_member_id && <span style={assignmentIconStyle(item)} title={assignmentLabel(item)}>{assignmentIcon(item)}</span>}</button>)}{dayEvents.length > 3 && <button
  type="button"
  className="calendar-more"
  style={{ background: "transparent", border: 0, textAlign: "left", textDecoration: "underline" }}
  aria-label={`Visa alla ${dayEvents.length} aktiviteter den ${key}`}
  onClick={() => { setCurrentMonth(day); setView("week"); }}
>+ {dayEvents.length - 3} fler</button>}</span></div>; })}</div></> : <><div className="calendar-weekdays">{currentWeek.map((day, i) => <div key={dateKey(day)}>{weekdays[i]} {day.getDate()}</div>)}</div><div className="calendar-week-grid" style={weekGridStyle}>{currentWeek.map((day, index) => { const key = dateKey(day); const dayEvents = eventMap.get(key) ?? []; const dayBreaks = breaksForDate(day); return <div key={key} className={`calendar-week-day ${key === todayKey ? "today" : ""}`} style={{ ...weekDayStyle, ...(index === 6 ? { borderRight: 0 } : {}) }}><button type="button" className="calendar-day-surface" onClick={() => openAdd(day)}><span className="calendar-day-number">{day.getDate()}</span></button>{dayBreaks.map((item) => <button key={item.id} type="button" onClick={() => openBreakForm(undefined, item)} style={{ display: "block", width: "100%", border: 0, borderRadius: 5, background: "#fbeaea", color: "#c62828", padding: "5px 6px", marginBottom: 6, fontSize: 9, fontWeight: 800, textAlign: "left", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.break_type === "studiedag" ? "Studiedag" : item.title}</button>)}<span className="calendar-events">{dayEvents.map((item) => <button type="button" className="calendar-event-pill" style={eventStyle(item)} key={item.id} onClick={() => openEdit(item)}>{item.all_day || dateKey(new Date(item.starts_at)) !== key ? "" : `${timeLabel(item.starts_at)} `}{item.title}{item.responsible_member_id && <span style={assignmentIconStyle(item)} title={assignmentLabel(item)}>{assignmentIcon(item)}</span>}</button>)}</span></div>; })}</div></>}
    </section>

    {showForm && <div className="calendar-modal-backdrop" role="presentation"><form className="calendar-modal" onSubmit={handleSave}><div className="calendar-modal-heading"><div><p className="eyebrow">{editingEvent ? "AKTIVITET" : "NY AKTIVITET"}</p><h2>{editingEvent ? "Redigera aktivitet" : "Lägg till i kalendern"}</h2></div><button type="button" onClick={() => { setShowForm(false); setEditingEvent(null); }}>×</button></div>{error && <p className="family-admin-error">{error}</p>}
      <label className="calendar-field"><span>Titel</span><input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="T.ex. Fotbollsträning" /></label>
      <div className="calendar-form-row"><label className="calendar-field"><span>Datum</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label className="calendar-field"><span>Tid</span><input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label></div>
      <label className="calendar-field"><span>Plats</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="T.ex. Kista IP" /></label>
      <label className="calendar-field"><span>Beskrivning</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Valfri information" rows={3} /></label>
      <div className="calendar-form-row"><label className="calendar-field"><span>Gäller vem?</span><small style={{ color: "#6b7b8c", fontSize: 11 }}>Vem aktiviteten handlar om.</small><select value={form.target_member_id} onChange={(e) => setForm({ ...form, target_member_id: e.target.value })}><option value="">Hela familjen</option>{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label><label className="calendar-field"><span>Vem ansvarar?</span><small style={{ color: "#6b7b8c", fontSize: 11 }}>Vem som ska ta ansvar.</small><select value={form.responsible_member_id} onChange={(e) => setForm({ ...form, responsible_member_id: e.target.value })}><option value="">Ingen ansvarig vald</option>{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label></div>
      <label className="calendar-field"><span>Vilken typ?</span><small style={{ color: "#6b7b8c", fontSize: 11 }}>Kategori för aktiviteten.</small><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label>
      <label className="calendar-field"><span>När ska påminnelsen komma?</span><small style={{ color: "#6b7b8c", fontSize: 11 }}>Påminnelsen kopplas till den ansvariga personen.</small><select value={form.reminder_minutes} onChange={(e) => setForm({ ...form, reminder_minutes: e.target.value })}>{reminderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div style={{ borderTop: "1px solid #dbe3ea", marginTop: 6, paddingTop: 14 }}><label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#102a43", fontSize: 13 }}><input type="checkbox" checked={form.recurrence_enabled} onChange={(e) => setForm({ ...form, recurrence_enabled: e.target.checked, recurrence_days: e.target.checked && form.recurrence_days.length === 0 ? [((new Date(`${form.date}T12:00:00`).getDay() + 6) % 7)] : form.recurrence_days })} /> Återkommande aktivitet</label>{form.recurrence_enabled && <div style={{ marginTop: 10 }}><div style={{ color: "#6b7b8c", fontSize: 11, marginBottom: 6 }}>Välj vilka veckodagar aktiviteten ska återkomma.</div><div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>{weekdays.map((day, index) => <button key={day} type="button" onClick={() => toggleDay(index)} style={{ border: form.recurrence_days.includes(index) ? "1px solid #0b2d4d" : "1px solid #dbe3ea", background: form.recurrence_days.includes(index) ? "#0b2d4d" : "#ffffff", color: form.recurrence_days.includes(index) ? "#ffffff" : "#102a43", borderRadius: 7, padding: "7px 2px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{day}</button>)}</div><label className="calendar-field" style={{ marginTop: 10 }}><span>Återkom till och med</span><input type="date" required={form.recurrence_enabled} value={form.recurrence_end_date} min={form.date} onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })} /></label></div>}</div>
      <div style={{ marginTop: 8, marginBottom: 8, color: "#6b7b8c", fontSize: 12 }}>Färg i kalendern följer den som aktiviteten gäller. En färgad markering på kanten visar vem som är ansvarig.</div>
      {editingEvent?.responsible_member_id && <div style={{ border: "1px solid #dbe3ea", borderRadius: 10, padding: "10px 12px", marginBottom: 10, background: "#f8fafb" }}><strong>Ansvar:</strong> {memberById.get(editingEvent.responsible_member_id)?.display_name ?? "Familjemedlem"}<div style={{ marginTop: 3, color: "#6b7b8c", fontSize: 12 }}>{assignmentLabel(editingEvent)}.</div>{editingEvent.assignment_status === "pending" && editingEvent.responsible_member_id === currentMemberId && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button type="button" className="secondary" onClick={() => void respondToAssignment("declined")} disabled={responding}>{responding ? "Sparar..." : "Avböj"}</button><button type="button" className="primary" onClick={() => void respondToAssignment("accepted")} disabled={responding}>{responding ? "Sparar..." : "Acceptera"}</button></div>}</div>}
      <div className="calendar-modal-actions">{editingEvent && <button className="secondary" type="button" onClick={handleDelete} disabled={deleting || saving || responding}>{deleting ? "Tar bort..." : "Ta bort"}</button>}<span className="calendar-modal-spacer" /><button className="secondary" type="button" onClick={() => { setShowForm(false); setEditingEvent(null); }}>Avbryt</button><button className="primary" type="submit" disabled={saving || deleting || responding}>{saving ? "Sparar..." : "Spara aktivitet"}</button></div>
    </form></div>}

    {showBreakForm && <div className="calendar-modal-backdrop" role="presentation"><form className="calendar-modal" onSubmit={handleSaveBreak}><div className="calendar-modal-heading"><div><p className="eyebrow">LOV & STUDIEDAGAR</p><h2>{editingBreak ? "Redigera ledighet" : "Markera ledighet"}</h2></div><button type="button" onClick={() => { setShowBreakForm(false); setEditingBreak(null); }}>×</button></div>{error && <p className="family-admin-error">{error}</p>}<p className="muted" style={{ marginBottom: 16 }}>Markera en hel vecka eller flera dagar på en gång. Detta blir en tydlig markering i familjens kalender.</p><label className="calendar-field"><span>Namn</span><input autoFocus required value={breakForm.title} onChange={(e) => setBreakForm({ ...breakForm, title: e.target.value })} placeholder="T.ex. Höstlov" /></label><label className="calendar-field"><span>Typ</span><select value={breakForm.break_type} onChange={(e) => setBreakForm({ ...breakForm, break_type: e.target.value })}>{breakTypes.map((type) => <option key={type} value={type}>{type === "lov" ? "Lov" : type === "studiedag" ? "Studiedag" : "Annat"}</option>)}</select></label><div className="calendar-form-row"><label className="calendar-field"><span>Från</span><input type="date" required value={breakForm.starts_on} onChange={(e) => setBreakForm({ ...breakForm, starts_on: e.target.value })} /></label><label className="calendar-field"><span>Till</span><input type="date" required value={breakForm.ends_on} onChange={(e) => setBreakForm({ ...breakForm, ends_on: e.target.value })} /></label></div><div className="calendar-modal-actions">{editingBreak && <button className="secondary" type="button" onClick={handleDeleteBreak} disabled={deletingBreak || savingBreak}>{deletingBreak ? "Tar bort..." : "Ta bort"}</button>}<span className="calendar-modal-spacer" /><button className="secondary" type="button" onClick={() => { setShowBreakForm(false); setEditingBreak(null); }}>Avbryt</button><button className="primary" type="submit" disabled={savingBreak || deletingBreak}>{savingBreak ? "Sparar..." : editingBreak ? "Spara ändringar" : "Spara ledighet"}</button></div></form></div>}
  </main>;
}
