import SectionPage from "../section-page";
export default function HelpPage() {
  return <SectionPage title="Hjälp" subtitle="Se vad familjen behöver hjälp med och ta ansvar." items={[
    { title: "Kan någon skjutsa Oliwer?", meta: "Idag · 17:30", action: "Jag tar den" },
    { title: "Hämta paket på vägen hem", meta: "Senast 18:00", action: "Jag kan" },
  ]} actionLabel="+ Be om hjälp" />;
}
