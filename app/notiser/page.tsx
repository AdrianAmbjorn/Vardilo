"use client";

import Link from "next/link";
import { notificationDestination } from "@/lib/notification-destination";
import CalendarPushSettings from "./calendar-push-settings";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  metadata?: { starts_at?: unknown } | null;
  read_at: string | null;
  created_at: string;
};

const labels: Record<string, string> = {
  calendar: "Kalender",
  task: "Uppgift",
  help: "Hjälp",
  check_in: "Check-in",
  chat: "Chat",
  system: "Vardilo",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!auth.user && (!authError || authError.name === "AuthSessionMissingError")) {
        router.replace("/login");
        return;
      }
      if (authError || !auth.user) throw authError;

      const { data: member, error: memberError } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!member) {
        setLoadError("Ditt konto behöver vara kopplat till en familj för att visa notiser.");
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,body,href,metadata,read_at,created_at")
        .eq("recipient_member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data ?? []);
      setMemberId(member.id);
    } catch {
      setLoadError("Kunde inte ladda notiserna.");
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!memberId) return;
    const channel = supabase
      .channel(`notifications-${memberId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_member_id=eq.${memberId}`,
      }, ({ new: row }) => {
        const notification = row as Notification;
        setNotifications(current => [
          notification,
          ...current.filter(item => item.id !== notification.id),
        ].slice(0, 50));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_member_id=eq.${memberId}` }, ({ new: row }) => {
        const updated = row as Notification;
        setNotifications(current => current.map(item => item.id === updated.id ? updated : item));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [memberId, supabase]);

  async function markRead(id?: string) {
    if (!memberId || saving) return false;
    setSaving(true);
    setSaveError("");

    try {
      const readAt = new Date().toISOString();
      let update = supabase.from("notifications")
        .update({ read_at: readAt })
        .eq("recipient_member_id", memberId)
        .is("read_at", null);
      if (id) update = update.eq("id", id);

      const { data, error } = await update.select("id");
      if (error) throw error;

      const updated = new Set((data ?? []).map(row => row.id));
      setNotifications(current => current.map(notification =>
        updated.has(notification.id) ? { ...notification, read_at: readAt } : notification
      ));
      window.dispatchEvent(new Event("vardilo-notifications-read"));
      return true;
    } catch {
      setSaveError("Kunde inte markera notisen som läst. Försök igen.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function openNotification(notification: Notification) {
    if (!notification.read_at && !await markRead(notification.id)) return;
    const destination = notificationDestination(notification.href, notification.metadata?.starts_at);
    if (destination) router.push(destination);
  }

  const unread = notifications.some(notification => !notification.read_at);

  return (
    <main className="section-shell notifications-page">
      <style>{`
        .notifications-page .section-row > div { min-width: 0; overflow-wrap: anywhere; }
        .notifications-page .section-row > .secondary { flex-shrink: 0; min-height: 44px; }
        .notifications-page .section-row strong { min-width: 0; }
        .notifications-page .tag { flex-shrink: 0; }
        @media(max-width: 480px) {
          .notifications-page .section-row { flex-wrap: wrap; gap: 12px; padding: 16px; }
          .notifications-page .section-row > div { flex-basis: 100%; }
        }
      `}</style>
      <header className="section-header">
        <Link className="back-link" href="/">← Hem</Link>
        <div>
          <p className="eyebrow">VARDILO</p>
          <h1>Notiser</h1>
          <p className="muted">Det senaste som hänt i familjen.</p>
        </div>
        <button className="secondary" onClick={() => void markRead()} disabled={loading || Boolean(loadError) || !unread || saving}>
          Markera alla lästa
        </button>
      </header>
      <section className="section-card">
        {memberId && <CalendarPushSettings />}
        {saveError && <div className="section-row"><p role="alert">{saveError}</p></div>}
        {loading ? (
          <div className="section-row"><p className="muted" role="status">Laddar...</p></div>
        ) : loadError ? (
          <div className="section-row">
            <p role="alert">{loadError}</p>
            <button className="secondary" onClick={() => void load()}>Försök igen</button>
          </div>
        ) : notifications.length ? notifications.map(notification => (
          <div className="section-row" key={notification.id} style={{ background: notification.read_at ? "white" : "var(--red-soft)" }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <strong>{notification.title}</strong>
                {!notification.read_at && <span className="tag" style={{ background: "var(--red)", color: "white" }}>NY</span>}
              </div>
              {notification.body && <p>{notification.body}</p>}
              <p>{labels[notification.type] ?? "Vardilo"} · {formatDate(notification.created_at)}</p>
            </div>
            {(notification.href || !notification.read_at) && (
              <button
                className="secondary"
                disabled={saving && !notification.read_at}
                aria-label={`${notification.href ? "Öppna" : "Markera som läst"}: ${notification.title}`}
                onClick={() => void openNotification(notification)}
              >
                {notification.href ? "Öppna" : "Markera som läst"}
              </button>
            )}
          </div>
        )) : (
          <div className="section-row"><p className="muted">Inga notiser ännu.</p></div>
        )}
      </section>
    </main>
  );
}
