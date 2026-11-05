"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Countdown, CountdownKind, countdownRemaining, parseCountdownDate } from "@/lib/countdown";

const months = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
const emojis = ["🎂", "🎄", "🎉", "🏖️", "⚽", "✨", "🏡", "🎁"];

export default function PersonalCountdown({ memberId }: { memberId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<CountdownKind>("birthday");
  const [month, setMonth] = useState("1");
  const [day, setDay] = useState("1");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎉");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [today, setToday] = useState(() => new Date());
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadFailed(false); setCountdown(null); setEditing(false); setError("");
    void Promise.resolve(supabase.from("member_countdowns").select("kind,title,emoji,target_date,birthday_month,birthday_day").eq("member_id", memberId).maybeSingle()).then(({ data, error }) => {
      if (!active) return;
      if (error) { setLoadFailed(true); setError("Kunde inte läsa din nedräkning. Uppdatera appen och försök igen."); }
      else setCountdown(data as Countdown | null);
    }).catch(() => { if (active) { setLoadFailed(true); setError("Kunde inte läsa din nedräkning. Uppdatera appen och försök igen."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [memberId, supabase]);

  useEffect(() => {
    const update = () => setToday(new Date());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);

  function edit() {
    setError(""); setKind(countdown?.kind ?? "birthday"); setTitle(countdown?.kind === "custom" ? countdown.title : ""); setEmoji(countdown?.emoji ?? "🎉");
    const target = countdown ? parseCountdownDate(countdown.target_date) : null;
    setMonth(String(countdown?.birthday_month ?? (countdown?.kind === "birthday" && target ? target.getMonth() + 1 : 1))); setDay(String(countdown?.birthday_day ?? (countdown?.kind === "birthday" ? target?.getDate() ?? 1 : 1))); setDate(countdown?.kind === "custom" ? countdown.target_date : "");
    setEditing(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || loadFailed) return;
    const targetDate = kind === "christmas" ? "2000-12-24" : kind === "birthday" ? `2000-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : date;
    const draft: Countdown = { kind, birthday_month: kind === "birthday" ? Number(month) : countdown?.birthday_month ?? null, birthday_day: kind === "birthday" ? Number(day) : countdown?.birthday_day ?? null, target_date: targetDate, title: kind === "birthday" ? "Min födelsedag" : kind === "christmas" ? "Julafton" : title.trim(), emoji: kind === "birthday" ? "🎂" : kind === "christmas" ? "🎄" : emoji };
    const remaining = countdownRemaining(draft);
    if (!remaining || (kind === "custom" && (!draft.title || remaining.past))) { setError(kind === "birthday" ? "Välj en giltig dag och månad." : "Ange ett namn och ett datum som är idag eller framåt."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await supabase.from("member_countdowns").upsert({ ...draft, member_id: memberId, updated_at: new Date().toISOString() }, { onConflict: "member_id" }).select("kind,title,emoji,target_date,birthday_month,birthday_day").single();
      if (result.error) throw result.error;
      setCountdown(result.data as Countdown); setEditing(false);
    } catch { setError("Kunde inte spara nedräkningen. Dina val finns kvar – försök igen."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function remove() {
    if (lock.current || !window.confirm("Ta bort din nedräkning från startsidan?")) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await supabase.from("member_countdowns").delete().eq("member_id", memberId).select("member_id").single();
      if (result.error) throw result.error;
      setCountdown(null); setEditing(false);
    } catch { setError("Kunde inte ta bort nedräkningen. Försök igen."); }
    finally { lock.current = false; setBusy(false); }
  }

  const remaining = countdown && countdownRemaining(countdown, today);
  return <section className="card home-countdown" style={{ marginTop: 18, borderRadius: 22, background: "linear-gradient(130deg, #fff8ec, #ffffff)", overflow: "hidden" }} aria-label="Min nedräkning">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}><h3 style={{ margin: 0 }}>Nedräkning ✨</h3>{!loading && !loadFailed && <button type="button" className="secondary" disabled={busy} onClick={edit}>{countdown ? "Ändra" : "Välj nedräkning"}</button>}</div>
    {loading ? <p className="muted" role="status">Laddar nedräkning…</p> : countdown && remaining ? <div style={{ display: "flex", gap: 18, alignItems: "center", padding: "18px 0 6px", flexWrap: "wrap" }}>
      <span aria-hidden="true" style={{ fontSize: 44 }}>{countdown.emoji}</span><div style={{ minWidth: 0, overflowWrap: "anywhere" }}>{remaining.past ? <strong>Dagen har varit – välj något nytt att längta till 💛</strong> : remaining.days === 0 ? <strong style={{ fontSize: 23 }}>Idag är det dags! 🎉</strong> : <div><strong className="countdown-value" style={{ color: "var(--red)", fontSize: 42, lineHeight: 1 }}>{remaining.days}</strong><span style={{ marginLeft: 9 }}>{remaining.days === 1 ? "dag kvar" : "dagar kvar"}</span></div>}<p style={{ margin: "8px 0 0", fontWeight: 700 }}>{countdown.title}</p><p className="muted" style={{ margin: "4px 0 0" }}>{new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric" }).format(remaining.target)}</p></div>
    </div> : !loadFailed && <p className="muted">Hur långt är det till din födelsedag, julafton eller nästa äventyr?</p>}
    {editing && <form onSubmit={event => void save(event)} style={{ display: "grid", gap: 12, maxWidth: 480, marginTop: 18 }}>
      <label className="family-admin-field"><span>Vad längtar du till?</span><select disabled={busy} value={kind} onChange={event => setKind(event.target.value as CountdownKind)}><option value="birthday">🎂 Min födelsedag</option><option value="christmas">🎄 Julafton</option><option value="custom">✨ Eget evenemang</option></select></label>
      {kind === "birthday" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><label className="family-admin-field"><span>Dag</span><select disabled={busy} value={day} onChange={event => setDay(event.target.value)}>{Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}</select></label><label className="family-admin-field"><span>Månad</span><select disabled={busy} value={month} onChange={event => setMonth(event.target.value)}>{months.map((name, i) => <option key={name} value={String(i + 1)}>{name}</option>)}</select></label></div><small className="muted">Födelseår behövs inte. Den 29 februari räknas som 28 februari under år utan skottdag.</small></>}
      {kind === "christmas" && <p className="muted">Räknar till den 24 december och börjar om inför nästa jul.</p>}
      {kind === "custom" && <><label className="family-admin-field"><span>Namn</span><input disabled={busy} value={title} onChange={event => setTitle(event.target.value)} maxLength={60} placeholder="T.ex. Sommarlov eller fotbollscup" required /></label><label className="family-admin-field"><span>Datum</span><input disabled={busy} type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><label className="family-admin-field"><span>Emoji</span><select disabled={busy} value={emoji} onChange={event => setEmoji(event.target.value)}>{emojis.map(value => <option key={value} value={value}>{value}</option>)}</select></label></>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="primary" disabled={busy} type="submit">{busy ? "Sparar…" : "Spara nedräkning"}</button><button className="secondary" disabled={busy} type="button" onClick={() => { setEditing(false); setError(""); }}>Avbryt</button>{countdown && <button className="secondary" disabled={busy} type="button" onClick={() => void remove()}>Ta bort</button>}</div>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
