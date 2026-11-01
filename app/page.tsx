"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  ["Hem", "Överblick", "/"],
  ["Kalender", "Familjens vecka", "/kalender"],
  ["Check-in", "Var är jag?", "/check-in"],
  ["Uppgifter", "Ansvar & XP", "/uppgifter"],
  ["Hjälp", "Jag kan", "/hjalp"],
  ["Listor", "Gemensamt", "/listor"],
  ["Önskelistor", "Presenter", "/onskelistor"],
  ["Chat", "Familjen", "/chat"],
  ["Galleri", "Minnen", "/galleri"],
  ["Familj", "Medlemmar & roller", "/familj/admin"],
];

const weekDays = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

type Member = { id: string; family_id: string; display_name: string; role: string };
type CalendarEvent = { id: string; title: string; starts_at: string; location: string | null; target_member_id: string | null; responsible_member_id: string | null };
type MenuRow = { id?: string; menu_date: string; meal: string | null };

function HouseIcon() {
  return (
    <svg className="house-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-8.1Z" fill="currentColor" />
      <path d="M9.1 20v-5.2h5.8V20" fill="white" />
    </svg>
  );
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);
  const [menu, setMenu] = useState<MenuRow[]>([]);
  const [menuEnabled, setMenuEnabled] = useState(false);
  const [showMenuEditor, setShowMenuEditor] = useState(false);
  const [menuDraft, setMenuDraft] = useState<string[]>(Array(7).fill(""));
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [helpTaken, setHelpTaken] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingMenu, setSavingMenu] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekDates = weekDays.map((_, index) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + index);
    return d;
  });

  useEffect(() => {
    let active = true;

    async function loadHome() {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const { data: currentMember } = await supabase
        .from("family_members")
        .select("id, family_id, display_name, role")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (!currentMember) {
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const end = new Date(today);
      end.setDate(end.getDate() + 8);

      const [{ data: familyMembers }, { data: events }, { data: menuRows }] = await Promise.all([
        supabase.from("family_members").select("id, family_id, display_name, role").eq("family_id", currentMember.family_id).order("created_at"),
        supabase.from("calendar_events").select("id, title, starts_at, location, target_member_id, responsible_member_id").eq("family_id", currentMember.family_id).or(`target_member_id.is.null,target_member_id.eq.${currentMember.id},responsible_member_id.eq.${currentMember.id}`).gte("starts_at", now).lte("starts_at", end.toISOString()).order("starts_at").limit(1),
        supabase.from("family_meal_menu").select("id, menu_date, meal").eq("family_id", currentMember.family_id).gte("menu_date", dateKey(weekStart)).lte("menu_date", dateKey(weekDates[6])).order("menu_date"),
      ]);

      if (!active) return;
      setMember(currentMember);
      setMembers(familyMembers ?? []);
      setNextEvent(events?.[0] ?? null);
      setMenu(menuRows ?? []);
      setMenuEnabled((menuRows ?? []).some((row) => row.meal?.trim()));
      setLoading(false);
    }

    loadHome();
    return () => { active = false; };
  }, [router, supabase]);

  const canEditMenu = member?.role === "admin" || member?.role === "förälder";

  useEffect(() => {
    const draft = weekDates.map((date) => menu.find((row) => row.menu_date === dateKey(date))?.meal ?? "");
    setMenuDraft(draft);
  }, [menu]);

  async function saveMenu() {
    if (!member || !canEditMenu) return;
    setSavingMenu(true);

    const rows = weekDates.map((date, index) => ({
      family_id: member.family_id,
      menu_date: dateKey(date),
      meal: menuDraft[index].trim() || null,
      created_by: member.id,
    }));

    const { error } = await supabase
      .from("family_meal_menu")
      .upsert(rows, { onConflict: "family_id,menu_date" });

    if (!error) {
      const { data } = await supabase
        .from("family_meal_menu")
        .select("id, menu_date, meal")
        .eq("family_id", member.family_id)
        .gte("menu_date", dateKey(weekStart))
        .lte("menu_date", dateKey(weekDates[6]))
        .order("menu_date");
      setMenu(data ?? []);
      setMenuEnabled(menuDraft.some((value) => value.trim()));
      setShowMenuEditor(false);
    }

    setSavingMenu(false);
  }

  async function handleSignOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const displayName = member?.display_name ?? "familjen";
  const todayLabel = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long" }).format(today);
  const nextEventTarget = nextEvent?.target_member_id ? members.find((m) => m.id === nextEvent.target_member_id) : null;

  return (
    <main className="shell">
      <style>{`:root { --accent: #c62828; --accent-soft: #fbeaea; } input, select, textarea { color: #c62828 !important; caret-color: #c62828; } input::placeholder, textarea::placeholder { color: #6b7b8c !important; opacity: 1; }`}</style>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <div className="brand-mark" aria-label="Vardilo" style={{ background: "#c62828", borderRadius: "50%", width: 40, height: 40, minWidth: 40, padding: 0, display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "none", position: "relative", zIndex: 1 }}>
            <HouseIcon />
          </div>
          <div><strong>VARDILO</strong><span>Family life, together.</span></div>
        </Link>

        <nav aria-label="Huvudmeny">
          {navItems.map(([title, subtitle, href], index) => (
            <Link className={index === 0 ? "nav-item active" : "nav-item"} href={href} key={title}>
              <span>{title}</span><small>{subtitle}</small>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="family-label">FAMILJEN</div>
          {members.map((person) => (
            <div className="member" key={person.id}><span className="avatar">{person.display_name.charAt(0).toUpperCase()}</span><span><strong>{person.display_name}</strong><small>{person.role}</small></span></div>
          ))}
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">{todayLabel}</p><h1>God kväll, <span className="red-text">{displayName}.</span></h1></div>
          <div className="profile-wrap">
            <button className="profile" type="button" aria-label="Öppna profilmeny" aria-expanded={showProfile} onClick={() => setShowProfile((value) => !value)}>{displayName.charAt(0).toUpperCase()}</button>
            {showProfile && <div className="profile-menu" role="menu"><div className="profile-menu-name"><strong>{displayName}</strong><span>{member?.role}</span></div><button type="button" onClick={handleSignOut} disabled={loggingOut}>{loggingOut ? "Loggar ut..." : "Logga ut"}</button></div>}
          </div>
        </header>

        <section className="hero-card">
          <div><p className="eyebrow">HEM</p><h2>Vad behöver familjen veta just nu?</h2><p className="muted">Vardilo samlar kalender, ansvar, listor och familjens små saker på ett ställe.</p></div>
          <div className="hero-actions"><button className="primary" type="button" onClick={() => setShowAdd((value) => !value)}>+ Lägg till</button><Link className="secondary" href="/hjalp">Jag kan hjälpa till</Link></div>
        </section>

        {showAdd && <div className="quick-add" role="dialog" aria-label="Lägg till"><strong>Vad vill du lägga till?</strong><div><Link href="/kalender">Händelse</Link><Link href="/uppgifter">Uppgift</Link><Link href="/hjalp">Hjälp</Link><Link href="/listor">Listpunkt</Link></div></div>}

        <div className="grid">
          <section className="card today">
            <div className="card-heading"><h3>Nästa händelse</h3><Link href="/kalender">Kalender</Link></div>
            {loading ? <p className="muted">Laddar...</p> : nextEvent ? <div className="event"><div className="time">{formatEventTime(nextEvent.starts_at)}</div><div><strong>{nextEvent.title}</strong><p>{nextEvent.target_member_id === member?.id ? "För dig" : nextEvent.responsible_member_id === member?.id ? "Ditt ansvar" : nextEventTarget?.display_name ?? "Familjen"}{nextEvent.location ? ` · ${nextEvent.location}` : ""}</p></div><span className="tag green">Kalender</span></div> : <p className="muted">Inga kommande aktiviteter hittades.</p>}
          </section>

          <section className="card help">
            <div className="card-heading"><h3><span className="red-dot">●</span> Jag kan</h3><span>{helpTaken ? "1 öppen" : "2 öppna"}</span></div>
            <div className="help-request"><div><strong>{helpTaken ? "Skjutsen är bekräftad" : "Kan någon skjutsa Oliwer?"}</strong><p>Idag · 17:30</p></div><button type="button" onClick={() => setHelpTaken(true)}>{helpTaken ? "✓ Jag tar den" : "Jag tar den"}</button></div>
            <div className="help-request"><div><strong>Hämta paket på vägen hem</strong><p>Senast 18:00</p></div><Link href="/hjalp">Jag kan</Link></div>
          </section>
        </div>

        <section className="card meal-menu" style={{ marginTop: 18 }}>
          <div className="card-heading"><h3>Veckans mat</h3>{canEditMenu && <button type="button" className="secondary" onClick={() => setShowMenuEditor((value) => !value)}>{showMenuEditor ? "Stäng" : "Redigera meny"}</button>}</div>
          {!menuEnabled && !showMenuEditor ? <div><p className="muted">Ingen matmeny är upplagd ännu.</p>{canEditMenu && <button type="button" className="primary" onClick={() => setShowMenuEditor(true)}>Lägg till veckans meny</button>}</div> : showMenuEditor ? (
            <div className="family-admin-form">
              {weekDays.map((day, index) => <label className="family-admin-field" key={day}><span>{day}</span><input style={{ color: "var(--red)" }} value={menuDraft[index]} onChange={(event) => setMenuDraft((draft) => draft.map((value, i) => i === index ? event.target.value : value))} placeholder="T.ex. tacos" /></label>)}
              <div className="hero-actions"><button className="primary" type="button" onClick={saveMenu} disabled={savingMenu}>{savingMenu ? "Sparar..." : "Spara veckans meny"}</button><button className="secondary" type="button" onClick={() => setShowMenuEditor(false)}>Avbryt</button></div>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {weekDays.map((day, index) => <div className="event" key={day}><div className="time">{day.slice(0, 3)}</div><div><strong style={{ color: "var(--red)" }}>{menuDraft[index] || "–"}</strong><p>{index === today.getDay() - 1 ? "Idag" : ""}</p></div></div>)}
            </div>
          )}
        </section>

        <div className="grid lower">
          <section className="card tasks"><div className="card-heading"><h3>Uppgifter</h3><span>320 XP totalt</span></div><div className="progress"><span style={{ width: "68%" }} /></div><p className="muted">Familjens mål: 500 XP till lördagsbelöningen</p><div className="task-row"><span className="check">✓</span><div><strong>Plocka undan efter middag</strong><p>Oliwer · +20 XP</p></div></div><div className="task-row"><span className="check">✓</span><div><strong>Vika tvätt</strong><p>Alicia · +30 XP</p></div></div></section>
          <section className="card chat"><div className="card-heading"><h3>Familjechat</h3><Link href="/chat">Öppna</Link></div><div className="message"><span className="avatar small">M</span><div><strong>Malin</strong><p>Glöm inte att vi behöver mjölk.</p><small>♡ Gilla</small></div></div><div className="message"><span className="avatar small">F</span><div><strong>Farmor</strong><p>Jag kan skjutsa Oliwer om ni behöver.</p><small>♥ 1 gilla</small></div></div></section>
        </div>
      </section>
    </main>
  );
}
