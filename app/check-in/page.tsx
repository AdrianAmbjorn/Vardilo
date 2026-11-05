"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; display_name: string; role: string };
type CheckIn = {
  id: string;
  member_id: string;
  check_in_type: "hem" | "skola" | "hos_van" | "annan";
  place_name: string | null;
  latitude: number;
  longitude: number;
  note: string | null;
  created_at: string;
};
type KnownPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  check_in_type: CheckIn["check_in_type"];
};

const typeLabels: Record<CheckIn["check_in_type"], string> = {
  hem: "Hemma",
  skola: "Skola",
  hos_van: "Hos en vän",
  annan: "Annan plats",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(new Date(value));
}

export default function CheckInPage() {
  const supabase = useMemo(() => createClient(), []);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [knownPlaces, setKnownPlaces] = useState<KnownPlace[]>([]);
  const [type, setType] = useState<CheckIn["check_in_type"]>("hem");
  const [placeName, setPlaceName] = useState("");
  const [selectedKnownPlaceId, setSelectedKnownPlaceId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Logga in för att checka in."); setLoading(false); return; }

    const { data: membership, error: membershipError } = await supabase
      .from("family_members")
      .select("id,family_id,display_name,role")
      .eq("user_id", auth.user.id)
      .limit(1)
      .single();

    if (membershipError || !membership) {
      setError("Kunde inte hitta familjen för ditt konto.");
      setLoading(false);
      return;
    }

    setFamilyId(membership.family_id);
    setCurrentMember(membership as Member);

    const [memberResult, checkInResult, knownPlaceResult] = await Promise.all([
      supabase.from("family_members").select("id,display_name,role").eq("family_id", membership.family_id).order("display_name"),
      supabase.from("check_ins").select("id,member_id,check_in_type,place_name,latitude,longitude,note,created_at").eq("family_id", membership.family_id).order("created_at", { ascending: false }).limit(30),
      supabase.from("check_in_known_places").select("id,name,latitude,longitude,check_in_type").eq("family_id", membership.family_id).order("name"),
    ]);

    if (memberResult.error) setError(memberResult.error.message);
    else setMembers((memberResult.data ?? []) as Member[]);
    if (checkInResult.error) setError(checkInResult.error.message);
    else setCheckIns((checkInResult.data ?? []) as CheckIn[]);
    if (knownPlaceResult.error) setError(knownPlaceResult.error.message);
    else setKnownPlaces((knownPlaceResult.data ?? []) as KnownPlace[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const memberById = new Map(members.map((member) => [member.id, member]));
  const latestByMember = new Map<string, CheckIn>();
  for (const item of checkIns) if (!latestByMember.has(item.member_id)) latestByMember.set(item.member_id, item);
  const visibleCheckIns = checkIns.filter((item) => currentMember?.role === "admin" || currentMember?.role === "förälder" || item.member_id === currentMember?.id);
  const latest = visibleCheckIns.find(item => item.member_id === currentMember?.id);

  function selectKnownPlace(placeId: string) {
    setSelectedKnownPlaceId(placeId);
    if (!placeId) return;
    const place = knownPlaces.find((item) => item.id === placeId);
    if (!place) return;
    setPlaceName(place.name);
    setType(place.check_in_type);
  }

  async function handleCheckIn() {
    if (!familyId || !currentMember || saving) return;
    if (!navigator.geolocation) {
      setError("Din webbläsare stöder inte platsdelning.");
      return;
    }
    setSaving(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const cleanPlaceName = placeName.trim();
        const { error: insertError } = await supabase.from("check_ins").insert({
          family_id: familyId,
          member_id: currentMember.id,
          check_in_type: type,
          place_name: cleanPlaceName || null,
          latitude,
          longitude,
          note: note.trim() || null,
        });

        if (insertError) {
          setError(insertError.message);
        } else {
          if (cleanPlaceName) {
            const { error: knownPlaceError } = await supabase.from("check_in_known_places").upsert({
              family_id: familyId,
              name: cleanPlaceName,
              latitude,
              longitude,
              check_in_type: type,
              created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "family_id,name" });
            if (knownPlaceError) {
              setPlaceName("");
              setSelectedKnownPlaceId("");
              setNote("");
              await load();
              setError("Din check-in är sparad, men platsen kunde inte sparas som snabbval.");
              setSaving(false);
              return;
            }
          }
          setPlaceName("");
          setSelectedKnownPlaceId("");
          setNote("");
          await load();
        }
        setSaving(false);
      },
      (positionError) => {
        setError(positionError.code === 1 ? "Vardilo behöver tillåtelse att använda din plats för att checka in." : "Kunde inte hämta din position.");
        setSaving(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <div className="brand-mark" style={{ background: "#c62828", borderRadius: "50%", width: 40, height: 40, minWidth: 40, padding: 0, display: "grid", placeItems: "center" }}>
            <span style={{ color: "white", fontSize: 22 }}>⌂</span>
          </div>
          <div><strong>VARDILO</strong><span>Family life, together.</span></div>
        </Link>
        <nav aria-label="Huvudmeny">
          <Link className="nav-item" href="/"><span>Hem</span><small>Överblick</small></Link>
          <Link className="nav-item" href="/kalender"><span>Kalender</span><small>Familjens vecka</small></Link>
          <Link className="nav-item active" href="/check-in"><span>Check-in</span><small>Var är jag?</small></Link>
          <Link className="nav-item" href="/uppgifter"><span>Uppgifter</span><small>Ansvar & XP</small></Link>
          <Link className="nav-item" href="/hjalp"><span>Hjälp</span><small>Jag kan</small></Link>
          <Link className="nav-item" href="/listor"><span>Listor</span><small>Gemensamt</small></Link>
          <Link className="nav-item" href="/onskelistor"><span>Önskelistor</span><small>Presenter</small></Link>
          <Link className="nav-item" href="/chat"><span>Chat</span><small>Familjen</small></Link>
          <Link className="nav-item" href="/galleri"><span>Galleri</span><small>Minnen</small></Link>
          <Link className="nav-item" href="/familj/admin"><span>Familj</span><small>Medlemmar & roller</small></Link>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">CHECK-IN</p><h1>Var är familjen?</h1></div>
          <Link className="secondary" href="/">Hem</Link>
        </header>

        <section className="hero-card">
          <div>
            <p className="eyebrow">DIN SENASTE CHECK-IN</p>
            <h2>{latest ? `${typeLabels[latest.check_in_type]}${latest.place_name ? ` · ${latest.place_name}` : ""}` : "Ingen check-in ännu"}</h2>
            <p className="muted">{latest ? `${formatDate(latest.created_at)} · ${formatTime(latest.created_at)}` : "När du checkar in sparar Vardilo plats och tid."}</p>
          </div>
        </section>

        <div className="grid">
          <section className="card">
            <div className="card-heading"><h3>Checka in</h3><span>{currentMember?.display_name ?? ""}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="family-admin-field"><span>Var är du?</span><select value={type} onChange={(event) => { setType(event.target.value as CheckIn["check_in_type"]); setSelectedKnownPlaceId(""); }}><option value="hem">Hemma</option><option value="skola">Skola</option><option value="hos_van">Hos en vän</option><option value="annan">Annan plats</option></select></label>
              <label className="family-admin-field"><span>Känd plats <small>(valfritt)</small></span><select value={selectedKnownPlaceId} onChange={(event) => selectKnownPlace(event.target.value)}><option value="">Välj plats...</option>{knownPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
            </div>
            <label className="family-admin-field"><span>Platsnamn <small>(sparas som känd plats)</small></span><input value={placeName} onChange={(event) => { setPlaceName(event.target.value); setSelectedKnownPlaceId(""); }} placeholder="t.ex. Hos Matteo" /></label>
            <label className="family-admin-field"><span>Meddelande <small>(valfritt)</small></span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="t.ex. Jag går hem 17:30" /></label>
            <button className="primary" type="button" onClick={handleCheckIn} disabled={saving || !currentMember}>{saving ? "Hämtar plats..." : "Checka in här"}</button>
            {error && <p className="error-text">{error}</p>}
            <p className="muted" style={{ marginTop: 12 }}>När du använder ett nytt platsnamn sparas platsen automatiskt som en känd plats. Nästa gång kan du bara välja den i menyn.</p>
          </section>

          <section className="card">
            <div className="card-heading"><h3>Kända platser</h3><span>{knownPlaces.length} sparade</span></div>
            {knownPlaces.length === 0 ? <p className="muted">Inga kända platser ännu. Den första du checkar in på med ett platsnamn sparas automatiskt.</p> : knownPlaces.map((place) => <div className="event" key={place.id}><div className="time" style={{ color: "#2f6f9f" }}>⌖</div><div><strong style={{ color: "#2f6f9f", WebkitTextFillColor: "#2f6f9f" }}>{place.name}</strong><p style={{ color: "#2f6f9f", WebkitTextFillColor: "#2f6f9f" }}>{typeLabels[place.check_in_type]}</p></div><span className="tag blue">Snabbval</span></div>)}
          </section>
        </div>

        <div className="grid" style={{ marginTop: 20 }}>
          <section className="card">
            <div className="card-heading"><h3>Senaste platser</h3><span>{loading ? "Laddar..." : `${latestByMember.size} familjemedlemmar`}</span></div>
            {Array.from(latestByMember.values()).map((item) => {
              const member = memberById.get(item.member_id);
              if (!member) return null;
              if (!(currentMember?.role === "admin" || currentMember?.role === "förälder" || item.member_id === currentMember?.id)) return null;
              return <div className="event" key={item.id}>
                <div className="time" style={{ color: "#2f6f9f", WebkitTextFillColor: "#2f6f9f" }}>{formatTime(item.created_at)}</div>
                <div>
                  <strong style={{ color: "#2f6f9f", WebkitTextFillColor: "#2f6f9f" }}>{member.display_name}</strong>
                  <p style={{ color: "#2f6f9f", WebkitTextFillColor: "#2f6f9f" }}>{typeLabels[item.check_in_type]}{item.place_name ? ` · ${item.place_name}` : ""}</p>
                </div>
                <span className="tag green">Check-in</span>
              </div>;
            })}
          </section>
        </div>

        {latest && (
          <section className="card" style={{ marginTop: 20 }}>
            <div className="card-heading"><h3>Karta</h3><span>{memberById.get(latest.member_id)?.display_name ?? ""}</span></div>
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)" }}>
              <iframe title="Senaste check-in på karta" src={`https://www.openstreetmap.org/export/embed.html?bbox=${latest.longitude - 0.01}%2C${latest.latitude - 0.006}%2C${latest.longitude + 0.01}%2C${latest.latitude + 0.006}&layer=mapnik&marker=${latest.latitude}%2C${latest.longitude}`} style={{ width: "100%", height: 360, border: 0 }} loading="lazy" />
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
