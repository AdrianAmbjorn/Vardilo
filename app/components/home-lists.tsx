"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const categoryEmoji: Record<string, string> = { Mathandling: "🛒", Storhelg: "🎄", Fest: "🎉", Hemmet: "🏠" };

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
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48, padding: "10px 0", borderBottom: "1px solid var(--line)", color: "var(--text)", textDecoration: "none", fontWeight: 600 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><span aria-hidden="true" style={{ flexShrink: 0 }}>{categoryEmoji[list.category ?? ""] ?? "📝"}</span><span style={{ overflowWrap: "anywhere", minWidth: 0 }}>{list.name}</span></span>
              <span aria-hidden="true" style={{ color: "var(--muted)" }}>›</span>
            </Link>
          ))}
        </div> : <p className="muted">Inga listor ännu. <Link href="/listor">Skapa en lista</Link></p>}
    </section>
  );
}
