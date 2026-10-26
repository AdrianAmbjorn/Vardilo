import SectionPage from "../section-page";
export default function GalleryPage() {
  return <SectionPage title="Galleri" subtitle="Familjens bilder och minnen." items={[
    { title: "Familjekväll", meta: "12 bilder · Oktober 2026" },
    { title: "Sommar 2026", meta: "48 bilder" },
    { title: "Oliwers fotboll", meta: "23 bilder" },
  ]} actionLabel="+ Ladda upp" />;
}
