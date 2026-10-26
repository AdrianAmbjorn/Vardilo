import SectionPage from "../section-page";
export default function ListsPage() {
  return <SectionPage title="Listor" subtitle="Gemensamma listor för familjen." items={[
    { title: "Matbutiken", meta: "Mjölk · Bröd · Frukt" },
    { title: "Att göra hemma", meta: "Boka service · Byta lampa" },
  ]} actionLabel="+ Ny lista" />;
}
