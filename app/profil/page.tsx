"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

async function resizePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12_000_000) {
    throw new Error("Välj en JPEG-, PNG- eller WebP-bild på högst 12 MB.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context || !side) throw new Error("Kunde inte läsa bilden.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 256, 256);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Kunde inte spara bilden.")), "image/jpeg", 0.86);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const bucket = useMemo(() => supabase.storage.from("family-profile-photos"), [supabase]);
  const [member, setMember] = useState<{ id: string; family_id: string; display_name: string } | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Logga in för att ändra din profilbild.");
        const { data } = await supabase.from("family_members")
          .select("id,family_id,display_name").eq("user_id", auth.user.id).maybeSingle();
        if (!data) throw new Error("Ditt konto behöver vara kopplat till en familj.");
        if (!active) return;
        setMember(data);
        const name = `${data.id}.jpg`;
        const result = await bucket.list(data.family_id, { search: name });
        if (result.error) throw new Error("Kunde inte läsa din profilbild.");
        if (result.data.some(item => item.name === name)) {
          const result = await bucket.download(`${data.family_id}/${name}`);
          if (result.error) throw new Error("Kunde inte läsa din profilbild.");
          if (active) setPhoto(result.data);
        }
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Kunde inte öppna profilen.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [bucket, supabase]);

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !file || busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setStatus("");
    try {
      const photo = await resizePhoto(file);
      const { error } = await bucket.upload(`${member.family_id}/${member.id}.jpg`, photo, { upsert: true, contentType: "image/jpeg", cacheControl: "0" });
      if (error) throw new Error("Kunde inte ladda upp bilden. Försök igen.");
      setPhoto(photo);
      setFile(null);
      form.reset();
      setStatus("Profilbilden är sparad.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunde inte spara bilden.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!member || busy || !window.confirm("Ta bort din profilbild?")) return;
    setBusy(true);
    setStatus("");
    try {
      const { error } = await bucket.remove([`${member.family_id}/${member.id}.jpg`]);
      if (error) throw error;
      setPhoto(null);
      setStatus("Profilbilden är borttagen.");
    } catch {
      setStatus("Kunde inte ta bort profilbilden. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="section-shell">
      <header className="section-header">
        <Link className="back-link" href="/">← Hem</Link>
        <div><p className="eyebrow">VARDILO</p><h1>Min profil</h1></div>
      </header>
      <section className="section-card" style={{ padding: 20 }}>
        {loading && <p role="status">Laddar profil…</p>}
        {member && !loading && (
          <>
            <div className="avatar" style={{ width: 72, height: 72, overflow: "hidden", fontSize: 24 }}>
              {preview ? <img src={preview} alt="Din profilbild" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : member.display_name.trim().charAt(0).toUpperCase()}
            </div>
            <p>{member.display_name}</p>
            <p className="muted">Bilden visas för familjen och beskärs till en kvadrat.</p>
            <form onSubmit={save} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <input type="file" aria-label="Välj profilbild" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} disabled={busy} />
              <button className="primary" type="submit" disabled={!file || busy}>Spara profilbild</button>
              {photo && <button className="secondary" type="button" onClick={() => void remove()} disabled={busy}>Ta bort bild</button>}
            </form>
          </>
        )}
        {status && <p role="status">{status}</p>}
      </section>
    </main>
  );
}
