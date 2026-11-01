import Link from "next/link";

type Item = { title: string; meta: string; action?: string };

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20, display: "block" }}>
      <path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-8.1Z" fill="currentColor" />
      <path d="M9.1 20v-5.2h5.8V20" fill="white" />
    </svg>
  );
}

export default function SectionPage({
  title,
  subtitle,
  items,
  actionLabel = "+ Lägg till",
}: {
  title: string;
  subtitle: string;
  items: Item[];
  actionLabel?: string;
}) {
  return (
    <main className="section-shell">
      <Link href="/" aria-label="Till Vardilo hem" style={{ position: "fixed", top: 20, left: 22, zIndex: 30, display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 10, background: "#c62828", color: "#ffffff", textDecoration: "none", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", boxShadow: "0 5px 18px rgba(16,42,67,.14)" }}>
        <HouseIcon />
        <span>VARDILO</span>
      </Link>
      <header className="section-header">
        <Link href="/" className="back-link">← Hem</Link>
        <div>
          <p className="eyebrow">VARDILO</p>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <button className="primary" type="button">{actionLabel}</button>
      </header>
      <section className="section-card">
        {items.map((item) => (
          <div className="section-row" key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <p>{item.meta}</p>
            </div>
            {item.action && <button className="secondary" type="button">{item.action}</button>}
          </div>
        ))}
      </section>
    </main>
  );
}
