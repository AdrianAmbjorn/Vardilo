import SectionPage from "../section-page";
export default function TasksPage() {
  return <SectionPage title="Uppgifter" subtitle="Ansvar, uppgifter och XP för familjen." items={[
    { title: "Plocka undan efter middag", meta: "Oliwer · +20 XP · Klar" },
    { title: "Vika tvätt", meta: "Alicia · +30 XP · Klar" },
    { title: "Familjens mål", meta: "320 / 500 XP till lördagsbelöningen" },
  ]} actionLabel="+ Ny uppgift" />;
}
