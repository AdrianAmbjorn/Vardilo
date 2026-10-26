const navItems = [
  ["Hem", "Överblick"],
  ["Kalender", "Familjens vecka"],
  ["Uppgifter", "Ansvar & XP"],
  ["Hjälp", "Jag kan"],
  ["Listor", "Gemensamt"],
  ["Önskelistor", "Presenter"],
  ["Chat", "Familjen"],
  ["Galleri", "Minnen"],
];

const family = [
  { name: "Adrian", role: "Admin", initials: "A" },
  { name: "Malin", role: "Förälder", initials: "M" },
  { name: "Oliwer", role: "Barn", initials: "O" },
  { name: "Alicia", role: "Barn", initials: "A" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>VARDILO</strong>
            <span>Family life, together.</span>
          </div>
        </div>

        <nav aria-label="Huvudmeny">
          {navItems.map(([title, subtitle], index) => (
            <a className={index === 0 ? "nav-item active" : "nav-item"} href="#" key={title}>
              <span>{title}</span>
              <small>{subtitle}</small>
            </a>
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
            <h1>God kväll, Adrian.</h1>
          </div>
          <button className="profile">A</button>
        </header>

        <section className="hero-card">
          <div>
            <p className="eyebrow">HEM</p>
            <h2>Vad behöver familjen veta just nu?</h2>
            <p className="muted">Vardilo samlar kalender, ansvar, listor och familjens små saker på ett ställe.</p>
          </div>
          <div className="hero-actions">
            <button className="primary">+ Lägg till</button>
            <button className="secondary">Jag kan hjälpa till</button>
          </div>
        </section>

        <div className="grid">
          <section className="card today">
            <div className="card-heading"><h3>Idag</h3><span>3 saker</span></div>
            <div className="event"><div className="time">16:30</div><div><strong>Hämta Alicia</strong><p>Adrian · Skola</p></div><span className="tag blue">Ansvar</span></div>
            <div className="event"><div className="time">18:00</div><div><strong>Fotbollsträning</strong><p>Oliwer · Kista IP</p></div><span className="tag green">Kalender</span></div>
            <div className="event"><div className="time">20:00</div><div><strong>Familjekväll</strong><p>Alla · Hemma</p></div><span className="tag purple">Familj</span></div>
          </section>

          <section className="card help">
            <div className="card-heading"><h3>Jag kan</h3><span>2 öppna</span></div>
            <div className="help-request"><div><strong>Kan någon skjutsa Oliwer?</strong><p>Idag · 17:30</p></div><button>Jag tar den</button></div>
            <div className="help-request"><div><strong>Hämta paket på vägen hem</strong><p>Senast 18:00</p></div><button>Jag kan</button></div>
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
            <div className="card-heading"><h3>Familjechat</h3><span>Nu</span></div>
            <div className="message"><span className="avatar small">M</span><div><strong>Malin</strong><p>Glöm inte att vi behöver mjölk.</p><small>♡ Gilla</small></div></div>
            <div className="message"><span className="avatar small">F</span><div><strong>Farmor</strong><p>Jag kan skjutsa Oliwer om ni behöver.</p><small>♥ 1 gilla</small></div></div>
          </section>
        </div>
      </section>
    </main>
  );
}
