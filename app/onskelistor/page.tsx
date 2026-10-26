import SectionPage from "../section-page";
export default function WishlistsPage() {
  return <SectionPage title="Önskelistor" subtitle="Familjens önskningar och presenter." items={[
    { title: "Oliwers önskelista", meta: "5 önskningar" },
    { title: "Alicias önskelista", meta: "7 önskningar" },
    { title: "Presenter", meta: "2 reserverade" },
  ]} actionLabel="+ Lägg till önskning" />;
}
