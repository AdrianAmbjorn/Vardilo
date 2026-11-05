"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "./daily-riddle.css";

type Riddle = {
  puzzle_date: string; server_now: string; closes_at: string; closed: boolean;
  question: string; hint: string; solution: string | null; explanation: string | null;
  own_guess: string | null; answer_count: number;
  guesses: { member_id: string; name: string; guess: string }[];
};

export default function DailyRiddle({ memberId }: { memberId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [riddle, setRiddle] = useState<Riddle | null>(null);
  const [previous, setPrevious] = useState<Riddle | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);
  const [previousLoading, setPreviousLoading] = useState(false);
  const [previousError, setPreviousError] = useState("");
  const previousRequest = useRef(0);
  const previousLock = useRef(false);
  const [guess, setGuess] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const dirty = useRef(false);
  const day = useRef("");
  const request = useRef(0);

  const apply = useCallback((next: Riddle, saved = false) => {
    if (day.current !== next.puzzle_date) {
      day.current = next.puzzle_date; dirty.current = false; previousRequest.current++; previousLock.current = false; setPrevious(null); setShowPrevious(false); setPreviousError(""); setPreviousLoading(false); setShowHint(false); setNotice(""); setSaveError("");
    }
    setRiddle(next);
    if (saved || !dirty.current) { setGuess(next.own_guess ?? ""); dirty.current = false; }
  }, []);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const result = await supabase.rpc("get_daily_family_riddle");
      if (id !== request.current) return;
      if (result.error || !result.data?.puzzle_date) throw result.error;
      apply(result.data as Riddle); setLoadError("");
    } catch { if (id === request.current) setLoadError("Kunde inte hämta dagens kluring. Försök igen."); }
    finally { if (id === request.current) setLoading(false); }
  }, [supabase, memberId, apply]);

  useEffect(() => {
    setLoading(true); setRiddle(null); setGuess(""); setNotice(""); setSaveError(""); day.current = ""; dirty.current = false;
    void load();
    const refresh = () => { if (document.visibilityState === "visible" && !lock.current) void load(); };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh); window.addEventListener("focus", refresh);
    return () => { request.current++; previousRequest.current++; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [load]);

  useEffect(() => {
    if (!riddle || riddle.closed) return;
    // Server time sets the boundary; changing the device clock cannot reveal the answer early.
    const remaining = Date.parse(riddle.closes_at) - Date.parse(riddle.server_now);
    const timer = window.setTimeout(() => { if (!lock.current) void load(); }, Math.max(500, remaining + 150));
    return () => window.clearTimeout(timer);
  }, [riddle, load]);

  async function togglePrevious(retry = false) {
    if (showPrevious && !retry) { setShowPrevious(false); return; }
    setShowPrevious(true);
    if ((!retry && previous) || previousLock.current) return;
    previousLock.current = true; setPreviousLoading(true); setPreviousError("");
    const id = ++previousRequest.current;
    try {
      const result = await supabase.rpc("get_previous_family_riddle");
      if (id !== previousRequest.current) return;
      if (result.error || !result.data?.closed || !result.data?.solution) throw result.error;
      setPrevious(result.data as Riddle);
    } catch { if (id === previousRequest.current) setPreviousError("Kunde inte hämta gårdagens kluring. Försök igen."); }
    finally { if (id === previousRequest.current) { previousLock.current = false; setPreviousLoading(false); } }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!riddle || riddle.closed || lock.current || !guess.trim()) return;
    lock.current = true; request.current++; setBusy(true); setSaveError(""); setNotice("");
    try {
      const result = await supabase.rpc("save_daily_family_guess", { p_puzzle_date: riddle.puzzle_date, p_guess: guess.trim() });
      if (result.error || !result.data?.puzzle_date) throw result.error;
      apply(result.data as Riddle, true); setNotice("Din gissning är sparad.");
    } catch (error) {
      await load();
      const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
      setSaveError(message.includes("Tiden är ute") || message.includes("ny kluring") ? message : "Kunde inte spara din gissning. Texten finns kvar – försök igen.");
    } finally { lock.current = false; setBusy(false); }
  }

  return <section className="card daily-riddle" aria-labelledby="daily-riddle-title">
    <header className="daily-riddle-heading"><div><span className="daily-riddle-icon" aria-hidden="true">🧩</span><h3 id="daily-riddle-title">Dagens kluring</h3></div><span className="daily-riddle-deadline">{riddle?.closed ? "Dagens lösning" : "Gissa före 21.00"}</span></header>
    {loading && <p className="muted" role="status">Hämtar en kluring till familjen…</p>}
    {loadError && <div><p role="alert">{loadError}</p><button className="secondary" type="button" disabled={busy} onClick={() => void load()}>Försök igen</button></div>}
    {riddle && <>
      <p className="daily-riddle-question">{riddle.question}</p>
      {!riddle.closed ? <>
        <p className="daily-riddle-help">Vad tror du? Svara själv och jämför med familjen när lösningen visas kl. 21.00, svensk tid.</p>
        <button className="daily-riddle-hint-button" type="button" aria-expanded={showHint} onClick={() => setShowHint(value => !value)}>{showHint ? "Dölj ledtråd" : "Jag vill ha en ledtråd"}</button>
        {showHint && <p className="daily-riddle-hint">💡 {riddle.hint}</p>}
        <form className="daily-riddle-form" onSubmit={event => void save(event)}>
          <label htmlFor="daily-riddle-guess">Din gissning</label>
          <textarea id="daily-riddle-guess" rows={2} maxLength={200} value={guess} disabled={busy} onChange={event => { dirty.current = true; setGuess(event.target.value); setNotice(""); }} placeholder="Jag tror att svaret är…" required />
          <div><button className="primary" type="submit" disabled={busy || !guess.trim() || guess.trim() === riddle.own_guess}>{busy ? "Sparar…" : riddle.own_guess ? "Spara ändringen" : "Spara min gissning"}</button>{riddle.own_guess && !notice && <span className="daily-riddle-saved">✓ Din gissning är sparad</span>}</div>
        </form>
        <p className="daily-riddle-footnote">Du kan ändra din gissning fram till kl. 21.00. {riddle.answer_count > 0 && `${riddle.answer_count} i familjen har gissat.`}</p>
      </> : <>
        <div className="daily-riddle-solution"><span>Svaret är</span><strong>{riddle.solution}</strong>{riddle.explanation && <p>{riddle.explanation}</p>}</div>
        <h4>Så tänkte familjen</h4>
        {riddle.guesses.length ? <ul className="daily-riddle-guesses">{riddle.guesses.map(answer => <li key={answer.member_id}><strong>{answer.name}</strong><p>{answer.guess}</p></li>)}</ul> : <p className="muted">Ingen gissning idag. En ny chans väntar imorgon!</p>}
        <p className="daily-riddle-footnote">En ny kluring dyker upp imorgon. Tack för att ni klurade tillsammans!</p>
      </>}
    </>}
    {notice && <p className="daily-riddle-saved" role="status">✓ {notice}</p>}
    {saveError && <p role="alert">{saveError}</p>}
    {!loading && riddle && <div className="daily-riddle-history">
      <button className="daily-riddle-hint-button" type="button" aria-expanded={showPrevious} onClick={() => void togglePrevious()}>{showPrevious ? "Stäng gårdagens kluring" : "Missade du igår? Se kluringen och familjens svar"}</button>
      {showPrevious && <div className="daily-riddle-history-content">
        {previousLoading && <p role="status">Hämtar gårdagens kluring…</p>}
        {previousError && <div><p role="alert">{previousError}</p><button type="button" className="secondary" onClick={() => void togglePrevious(true)}>Försök igen</button></div>}
        {previous && <>
          <h4>Gårdagens kluring <span>{new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", timeZone: "Europe/Stockholm" }).format(new Date(`${previous.puzzle_date}T12:00:00Z`))}</span></h4>
          <p className="daily-riddle-question">{previous.question}</p>
          <div className="daily-riddle-solution"><span>Svaret är</span><strong>{previous.solution}</strong>{previous.explanation && <p>{previous.explanation}</p>}</div>
          <h4>Så tänkte familjen</h4>
          {previous.guesses.length ? <ul className="daily-riddle-guesses">{previous.guesses.map(answer => <li key={answer.member_id}><strong>{answer.name}</strong><p>{answer.guess}</p></li>)}</ul> : <p className="muted">Familjen lämnade inga gissningar igår.</p>}
        </>}
      </div>}
    </div>}
  </section>;
}
