"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  ["Hem", "Överblick", "/"],
  ["Kalender", "Familjens vecka", "/kalender"],
  ["Uppgifter", "Ansvar & XP", "/uppgifter"],
  ["Hjälp", "Jag kan", "/hjalp"],
  ["Listor", "Gemensamt", "/listor"],
  ["Önskelistor", "Presenter", "/onskelistor"],
  ["Chat", "Familjen", "/chat"],
  ["Galleri", "Minnen", "/galleri"],
  ["Familj", "Medlemmar & roller", "/familj/admin"],
];

const family = [
  { name: "Adrian", role: "Admin", initials: "A" },
  { name: "Malin", role: "Förälder", initials: "M" },
  { name: "Oliwer", role: "Barn", initials: "O" },
  { name: "Alicia", role: "Barn", initials: "A" },
  { name: "Farmor", role: "Familj", initials: "F" },
  { name: "Farfar", role: "Familj", initials: "F" },
];

function HouseIcon() {
  return (
    <svg className="house-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-8.1Z" fill="currentColor" />
      <path d="M9.1 20v-5.2h5.8V20" fill="white" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [helpTaken, setHelpTaken] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSignOut() {
    if (loggingOut) return;
    setLoggingOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <div className="brand-mark" aria-label="Vardilo"><HouseIcon /></div>
          <div>
            <strong>VARDILO</strong>
            <span>Family life, together.</span>
          </div>
        </Link>

        <nav aria-label="Huvudmeny">
          {navItems.map(([title, subtitle, href], index) => (
            <Link className={index === 0 ? "nav-item active" : "nav-item"} href={href} key={title}>
              <span>{title}</span>
              <small>{subtitle}</small>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="family-label">FAMILJEN</div>
          {family.map((member) => (
            <div className="member" key={member.name}>
              <span className="avatar">{member.initials}</span>
              <span>
                <strong>{member.name}</strong>
                <small>{member.role}</small>
              </span>
            </div>
          ))}
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Måndag 26 oktober</p>
            <h1>God kväll, <span className="red-text">Adrian.</span></h1>
          </div>
          <div className="profile-wrap">
            <button
              className="profile"
              type="button"
              aria-label="Öppna profilmeny"
              aria-expanded={showProfile}
              onClick={() => setShowProfile((value) => !value)}
            >
              A
            </button>
            {showProfile && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-name">
                  <strong>Adrian</strong>
                  <span>Admin</span>
                </div>
                <button type="button" onClick={handleSignOut} disabled={loggingOut}>
                  {loggingOut ? "Loggar ut..." : "Logga ut"}
                </button>
              </div>
            )}
          </div>
        </header>

        <section className="hero-card">
          <div>
            <p className="eyebrow">HEM</p>
            <h2>Vad behöver familjen veta just nu?</h2>
            <p className="muted">Vardilo samlar kalender, ansvar, listor och familjens små saker på ett ställe.</p>
          </div>
          <div className="hero-actions">
            <button className="primary" type="button" onClick={() => setShowAdd((value) => !value)}>+ Lägg till</button>
            <Link className="secondary" href="/hjalp">Jag kan hjälpa till</Link>
          </div>
        </section>

        {showAdd && (
          <div className="quick-add" role="dialog" aria-label="Lägg till">
            <strong>Vad vill du lägga till?</strong>
            <div>
              <Link href="/kalender">Händelse</Link>
              <Link href="/uppgifter">Uppgift</Link>
              <Link href="/hjalp">Hjälp</Link>
              <Link href="/listor">Listpunkt</Link>
            </div>
          </div>
        )}

        <div className="grid">
          <section className="card today">
            <div className="card-heading"><h3>Idag</h3><span>3 saker</span></div>
            <div className="event"><div className="time">16:30</div><div><strong>Hämta Alicia</strong><p>Adrian · Skola</p></div><span className="tag blue">Ansvar</span></div>
            <div className="event"><div className="time">18:00</div><div><strong>Fotbollsträning</strong><p>Oliwer · Kista IP</p></div><span className="tag green">Kalender</span></div>
            <div className="event"><div className="time">20:00</div><div><strong>Familjekväll</strong><p>Alla · Hemma</p></div><span className="tag purple">Familj</span></div>
          </section>

          <section className="card help">
            <div className="card-heading"><h3><span className="red-dot">●</span> Jag kan</h3><span>{helpTaken ? "1 öppen" : "2 öppna"}</span></div>
            <div className="help-request">
              <div><strong>{helpTaken ? "Skjutsen är bekräftad" : "Kan någon skjutsa Oliwer?"}</strong><p>Idag · 17:30</p></div>
              <button type="button" onClick={() => setHelpTaken(true)}>{helpTaken ? "✓ Jag tar den" : "Jag tar den"}</button>
            </div>
            <div className="help-request"><div><strong>Hämta paket på vägen hem</strong><p>Senast 18:00</p></div><Link href="/hjalp">Jag kan</Link></div>
          </section>
        </div>

        <div className="grid lower">
          <section className="card tasks">
            <div className="card-heading"><h3>Uppgifter</h3><span>320 XP totalt</span></div>
            <div className="progress"><span style={{ width: "68%" }} /></div>
            <p className="muted">Familjens mål: 500 XP till lördagsbelöningen</p>
            <div className="task-row"><span className="check">✓</span><div><strong>Plocka undan efter middag</strong><p>Oliwer · +20 XP</p></div></div>
            <div className="task-row"><span className="check">✓</span><div><strong>Vika tvätt</strong><p>Alicia · +30 XP</p></div></div>
          </section>

          <section className="card chat">
            <div className="card-heading"><h3>Familjechat</h3><Link href="/chat">Öppna</Link></div>
            <div className="message"><span className="avatar small">M</span><div><strong>Malin</strong><p>Glöm inte att vi behöver mjölk.</p><small>♡ Gilla</small></div></div>
            <div className="message"><span className="avatar small">F</span><div><strong>Farmor</strong><p>Jag kan skjutsa Oliwer om ni behöver.</p><small>♥ 1 gilla</small></div></div>
          </section>
        </div>
      </section>
    </main>
  );
}
