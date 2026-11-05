"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const categoryEmoji: Record<string, string> = { Mathandling: "🛒", Storhelg: "🎄", Fest: "🎉", Hemmet: "🏠", "Till hemmet": "🏠" };

export default function HomeLists({ familyId }: { familyId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [lists, setLists] = useState<{ id: string; name: string; category: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void supabase.from("family_lists").select("id,name,category").eq("family_id", familyId)
      .order("created_at").then(({ data, error }) => {
        if (!active) return;
        setLists(data ?? []);
        setError(Boolean(error));
        setLoading(false);
      });
    return () => { active = false; };
  }, [familyId, supabase]);

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <div className="card-heading"><h3>Listor</h3><Link href="/listor">Alla listor</Link></div>
      {loading ? <p className="muted" role="status">Laddar listor…</p> :
        error ? <p className="muted">Kunde inte läsa listorna. <Link href="/listor">Öppna Listor</Link></p> :
        lists.length ? <div style={{ display: "grid" }}>
          {lists.map(list => (
            <Link key={list.id} href={`/listor?lista=${encodeURIComponent(list.id)}`}
              className="home-list-link">
              <span><span aria-hidden="true" className="home-list-emoji">{categoryEmoji[list.category ?? ""] ?? "📝"}</span><span className="home-list-name">{list.name}</span></span>
              <span aria-hidden="true" className="home-list-arrow">›</span>
            </Link>
          ))}
        </div> : <p className="muted">Inga listor ännu. <Link href="/listor">Skapa en lista</Link></p>}
    </section>
  );
}
