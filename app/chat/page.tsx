import SectionPage from "../section-page";
export default function ChatPage() {
  return <SectionPage title="Familjechat" subtitle="Meddelanden från familjen." items={[
    { title: "Malin", meta: "Glöm inte att vi behöver mjölk. · Nu" },
    { title: "Farmor", meta: "Jag kan skjutsa Oliwer om ni behöver. · 1 gilla" },
  ]} actionLabel="Skriv meddelande" />;
}
