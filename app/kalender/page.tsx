import SectionPage from "../section-page";
export default function CalendarPage() {
  return <SectionPage title="Kalender" subtitle="Familjens vecka på ett ställe." items={[
    { title: "Hämta Alicia", meta: "Idag · 16:30 · Adrian" },
    { title: "Fotbollsträning", meta: "Idag · 18:00 · Oliwer · Kista IP" },
    { title: "Familjekväll", meta: "Idag · 20:00 · Alla · Hemma" },
  ]} />;
}
