import Link from "next/link";
import HomeMark from "./components/home-mark";

type Item = { title: string; meta: string; action?: string };

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
      <header className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HomeMark />
        </div>
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
