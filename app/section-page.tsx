import Link from "next/link";

type Item = { title: string; meta: string; action?: string };

function HouseIcon() {
  return (
    <svg className="house-icon" viewBox="0 0 24 24" aria-hidden="true">
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
      <Link href="/" className="section-home-mark" aria-label="Till Vardilo hem">
        <span className="section-home-icon"><HouseIcon /></span>
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
