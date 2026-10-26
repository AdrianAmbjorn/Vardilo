import Link from "next/link";

const sections: Record<string, { title: string; description: string }> = {
  kalender: { title: "Kalender", description: "Familjens vecka samlad på ett ställe." },
  uppgifter: { title: "Uppgifter", description: "Ansvar, uppgifter och XP för familjen." },
  hjalp: { title: "Hjälp", description: "Se vad familjen behöver hjälp med och erbjud dig att ta ansvar." },
  listor: { title: "Listor", description: "Gemensamma inköps- och att-göra-listor." },
  onskelistor: { title: "Önskelistor", description: "Familjens önskningar och presenter." },
  chat: { title: "Familjechat", description: "Familjens meddelanden och saker som behöver göras." },
  galleri: { title: "Galleri", description: "Familjens bilder och minnen." },
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = sections[section] ?? { title: "Vardilo", description: "Den här sidan är på väg." };

  return (
    <main className="section-page">
      <section className="section-card">
        <Link href="/" className="back-link">← Till Hem</Link>
        <p className="eyebrow">VARDILO</p>
        <h1>{content.title}</h1>
        <p className="muted">{content.description}</p>
        <p className="muted" style={{ marginTop: 20 }}>Den här delen är nu klickbar. Nästa steg är att koppla den till riktig Supabase-data.</p>
      </section>
    </main>
  );
}
