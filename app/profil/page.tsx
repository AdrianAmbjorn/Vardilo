"use client";
import { useLanguage, LanguagePicker } from "../components/language-provider";

import Link from "next/link";
import BirthdaySettings from "../components/birthday-settings";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

async function loadPhoto(file: File) {
  const heic = ["image/heic", "image/heif"].includes(file.type) || /\.hei[cf]$/i.test(file.name);
  const standard = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
  if ((!standard && !heic) || file.size > 12_000_000) {
    throw new Error("Välj en JPEG-, PNG-, WebP-, HEIC- eller HEIF-bild på högst 12 MB.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error(heic ? "Din webbläsare kan inte öppna den här HEIC-bilden. Välj en JPEG-, PNG- eller WebP-bild, eller exportera bilden som JPEG från Bilder." : "Kunde inte läsa bilden."); }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Kunde inte läsa bilden.");
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const initialCrop = { zoom: 1, horizontal: 50, vertical: 50 };

function drawCrop(canvas: HTMLCanvasElement, image: HTMLImageElement, crop: typeof initialCrop) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Kunde inte förbereda beskärningen.");
  const side = Math.min(image.naturalWidth, image.naturalHeight) / crop.zoom;
  const x = (image.naturalWidth - side) * crop.horizontal / 100;
  const y = (image.naturalHeight - side) * crop.vertical / 100;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, x, y, side, side, 0, 0, canvas.width, canvas.height);
}

export default function ProfilePage() {
 const { t, language, locale } = useLanguage();

  const supabase = useMemo(() => createClient(), []);
  const bucket = useMemo(() => supabase.storage.from("family-profile-photos"), [supabase]);
  const [member, setMember] = useState<{ id: string; family_id: string; display_name: string } | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [draft, setDraft] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState(initialCrop);
  const cropCanvas = useRef<HTMLCanvasElement>(null);
  const [preparing, setPreparing] = useState(false);
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
    if (!file) return;
    let active = true;
    void loadPhoto(file).then(
      image => { if (active) setDraft(image); },
      error => { if (active) setStatus(error instanceof Error ? error.message : "Kunde inte läsa bilden."); },
    ).finally(() => { if (active) setPreparing(false); });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    if (draft && cropCanvas.current) drawCrop(cropCanvas.current, draft, crop);
  }, [draft, crop]);

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function chooseFile(next: File | null) {
    setDraft(null);
    setCrop(initialCrop);
    setStatus("");
    setPreparing(Boolean(next));
    setFile(next);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !draft || preparing || busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setStatus("");
    try {
      const canvas = cropCanvas.current;
      if (!canvas) throw new Error("Beskärningen är inte klar.");
      drawCrop(canvas, draft, crop);
      const image = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Kunde inte spara bilden.")), "image/jpeg", 0.86);
      });
      const { error } = await bucket.upload(`${member.family_id}/${member.id}.jpg`, image, { upsert: true, contentType: "image/jpeg", cacheControl: "0" });
      if (error) throw new Error("Kunde inte ladda upp bilden. Försök igen.");
      setPhoto(image);
      chooseFile(null);
      form.reset();
      setStatus("Profilbilden är sparad.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunde inte spara bilden.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!member || busy || !window.confirm(t("Ta bort din profilbild?"))) return;
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
        <Link className="back-link" href="/">{t("← Hem")}</Link>
        <div><p className="eyebrow">VARDILO</p><h1>{t("Min profil")}</h1></div>
      </header>
      <section className="section-card" style={{ padding: 20 }}>
        {loading && <p role="status">{t("Laddar profil…")}</p>}
        {member && !loading && (
          <>
            <div className="avatar" style={{ width: 72, height: 72, overflow: "hidden", fontSize: 24 }}>
              {preview ? <img src={preview} alt={t("Din sparade profilbild")} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : member.display_name.trim().charAt(0).toUpperCase()}
            </div>
            <p>{member.display_name}</p>
            <LanguagePicker />
            <p><Link href="/integritet">Integritet</Link> · <Link href="/villkor">Testvillkor</Link> · <Link href="/barn-och-integritet">Barnkonton</Link></p>
            <BirthdaySettings memberId={member.id} />
            {preparing && <p role="status">{t("Förbereder förhandsvisning…")}</p>}
            <p className="muted">{t("Bilden visas för familjen och beskärs till en kvadrat.")}</p>
            <form onSubmit={save} onReset={() => chooseFile(null)} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <input type="file" aria-label={t("Välj profilbild")} accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={event => chooseFile(event.target.files?.[0] ?? null)} disabled={busy} />
              {draft && (
                <fieldset disabled={busy} style={{ flexBasis: "100%", minWidth: 0, margin: "8px 0", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
                  <legend>{t("Beskär profilbild")}</legend>
                  <canvas ref={cropCanvas} width={256} height={256} role="img" aria-label={t("Förhandsvisning av beskuren profilbild")} style={{ display: "block", width: "min(100%, 256px)", height: "auto", borderRadius: "50%" }} />
                  <p className="muted">{t("Justera bilden innan du sparar.")}</p>
                  <div style={{ display: "grid", gap: 10, maxWidth: 320 }}>
                    <label>Zoom <input type="range" min={1} max={3} step={0.01} value={crop.zoom} onChange={event => setCrop({ ...crop, zoom: event.target.valueAsNumber })} /></label>
                    <label>{t("Vänster till höger")} <input type="range" min={0} max={100} value={crop.horizontal} onChange={event => setCrop({ ...crop, horizontal: event.target.valueAsNumber })} /></label>
                    <label>{t("Uppifrån och ned")} <input type="range" min={0} max={100} value={crop.vertical} onChange={event => setCrop({ ...crop, vertical: event.target.valueAsNumber })} /></label>
                  </div>
                </fieldset>
              )}
              <button className="primary" type="submit" disabled={!draft || preparing || busy}>{t("Spara profilbild")}</button>
              {file && <button className="secondary" type="reset" disabled={busy}>{t("Avbryt bildval")}</button>}
              {photo && !file && <button className="secondary" type="button" onClick={() => void remove()} disabled={busy}>{t("Ta bort bild")}</button>}
            </form>
          </>
        )}
        {status && <p role="status">{t(status)}</p>}
      </section>
    </main>
  );
}
