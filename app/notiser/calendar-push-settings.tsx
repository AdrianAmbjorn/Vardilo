"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function decodeKey(key: string) {
  return Uint8Array.from(atob(key.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
}

export default function CalendarPushSettings() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState<{ registration: ServiceWorkerRegistration; key: string }>();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) {
        if (active) setMessage("Push kräver en webbläsare som stöder det. På iPhone och iPad öppnar du Vardilo från hemskärmen.");
        return;
      }
      try {
        const { data: key, error } = await supabase.rpc("calendar_push_public_key");
        if (error || typeof key !== "string") throw new Error();
        await navigator.serviceWorker.register("/calendar-push.js");
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        const result = subscription ? await supabase.from("calendar_push_subscriptions")
          .select("endpoint").eq("endpoint", subscription.endpoint).maybeSingle() : null;
        if (result?.error) throw result.error;
        if (!active) return;
        setReady({ registration, key });
        setEnabled(Boolean(result?.data));
      } catch {
        if (active) setMessage("Kunde inte läsa pushinställningen. Ladda om sidan och försök igen.");
      }
    }
    void load();
    return () => { active = false; };
  }, [supabase]);

  async function toggle() {
    if (!ready || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const manager = ready.registration.pushManager;
      if (enabled) {
        const subscription = await manager.getSubscription();
        if (subscription) {
          const { error } = await supabase.from("calendar_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
          if (error) throw error;
          await subscription.unsubscribe().catch(() => false);
        }
        setEnabled(false);
        return;
      }

      const subscription = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(ready.key) });
      const { endpoint, keys } = subscription.toJSON();
      if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error();
      const { error } = await supabase.from("calendar_push_subscriptions").upsert({
        endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
      }, { onConflict: "endpoint", ignoreDuplicates: true });
      if (error) throw error;
      const result = await supabase.from("calendar_push_subscriptions").select("endpoint").eq("endpoint", endpoint).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        await subscription.unsubscribe();
        setMessage("Enheten var kopplad till ett annat konto. Tryck på Slå på push igen.");
        return;
      }
      setEnabled(true);
    } catch {
      setMessage(Notification.permission === "denied"
        ? "Notiser är blockerade på enheten. Ändra det i enhetens eller webbläsarens inställningar."
        : "Kunde inte ändra pushinställningen. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  async function showTestNotification() {
    if (!ready || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (await Notification.requestPermission() !== "granted") {
        setMessage("Webbläsaren har inte tillåtelse att visa notiser. Kontrollera webbplatsens notisbehörighet.");
        return;
      }
      await ready.registration.showNotification("Testnotis från Vardilo", {
        body: "Så här kan en kalenderpåminnelse visas på den här enheten.",
        icon: "/app-icon/192",
        tag: "vardilo-test",
      });
      setMessage("Testnotisen är skickad till enheten. Om du inte ser den, kontrollera notiscentret och enhetens notisinställningar.");
    } catch {
      setMessage("Kunde inte visa testnotisen. Kontrollera att Vardilo får visa notiser på enheten.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section-row" aria-label="Push för kalenderpåminnelser">
      <div>
        <strong>Push för kalenderpåminnelser</strong>
        <p>Kalenderpåminnelser kan visas även när Vardilo är stängd. Aktivitetens namn visas först i appen.</p>
        {message && <p role="status">{message}</p>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button className="secondary" type="button" disabled={!ready || busy} onClick={() => void toggle()}>
          {enabled ? "Stäng av push" : "Slå på push"}
        </button>
        <button className="secondary" type="button" disabled={!ready || busy} onClick={() => void showTestNotification()}>
            Visa testnotis
        </button>
      </div>
    </section>
  );
}
