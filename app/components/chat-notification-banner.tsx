"use client";
import { useLanguage } from "./language-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "./chat-notification-banner.css";

export default function ChatNotificationBanner({ variant = "banner" }: { variant?: "banner" | "badge" }) {
 const { t, language, locale } = useLanguage();

  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState(0);
  const [memberId, setMemberId] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let request = 0;
    const identify = async () => {
      const id = ++request;
      setMemberId(null); setUnread(0);
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user || !active || id !== request) return;
        const member = await supabase.from("family_members").select("id").eq("user_id", data.user.id).maybeSingle();
        if (active && id === request) setMemberId(member.data?.id ?? null);
      } catch { /* Keep the private badge hidden until the identity is known. */ }
    };
    if (pathname === "/losenord" || pathname.startsWith("/login") || pathname.startsWith("/auth/")) { setMemberId(null); setUnread(0); return; }
    void identify();
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") { request++; setMemberId(null); setUnread(0); }
      else if (event === "SIGNED_IN" || event === "USER_UPDATED") queueMicrotask(() => { if (active) void identify(); });
    });
    return () => { active = false; request++; listener.subscription.unsubscribe(); };
  }, [pathname, supabase]);

  useEffect(() => {
    if (!memberId) return;
    let active = true; let request = 0;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const id = ++request;
      try {
        let query = supabase.from("notifications").select("id", { count: "exact", head: true })
          .eq("recipient_member_id", memberId).is("read_at", null);
        if (variant === "badge") query = query.eq("type", "chat");
        const { count, error } = await query;
        if (active && id === request && !error) setUnread(count ?? 0);
      } catch { /* A transient connection failure keeps the last confirmed count. */ }
    };
    void refresh();
    const channel = supabase.channel(`global-chat-unread-${variant}-${memberId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_member_id=eq.${memberId}` }, () => void refresh())
      .subscribe(status => { if (status === "SUBSCRIBED") void refresh(); });
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); window.addEventListener("vardilo-chat-read", refresh); window.addEventListener("vardilo-notifications-read", refresh);
    return () => { active = false; request++; window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("vardilo-chat-read", refresh); window.removeEventListener("vardilo-notifications-read", refresh); void supabase.removeChannel(channel); };
  }, [memberId, supabase, variant]);
  if (!memberId || !unread) return null;
  if (variant === "badge") return <span className="home-chat-unread" role="status" aria-label={unread === 1 ? t("Ett oläst meddelande") : language === "en" ? `${unread} unread messages` : `${unread} olästa meddelanden`} title={t("Olästa meddelanden")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></span>;
  const label = language === "en" ? "Unread notifications" : "Olästa notiser";
  const message = language === "en" ? `You have ${unread} unread notification${unread === 1 ? "" : "s"}` : unread === 1 ? "Du har en oläst notis" : `Du har ${unread} olästa notiser`;
  return <aside className="chat-notification-banner" aria-label={label}><Link href="/notiser"><span className="chat-unread-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span><span role="status">{message}</span><strong>{language === "en" ? "View notifications" : "Visa notiser"} <span aria-hidden="true">›</span></strong></Link></aside>;
}
