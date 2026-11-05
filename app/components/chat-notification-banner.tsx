"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "./chat-notification-banner.css";

export default function ChatNotificationBanner() {
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
    if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) { setMemberId(null); setUnread(0); return; }
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
        const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true })
          .eq("recipient_member_id", memberId).eq("type", "chat").is("read_at", null);
        if (active && id === request && !error) setUnread(count ?? 0);
      } catch { /* A transient connection failure keeps the last confirmed count. */ }
    };
    void refresh();
    const channel = supabase.channel(`global-chat-unread-${memberId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_member_id=eq.${memberId}` }, () => void refresh())
      .subscribe(status => { if (status === "SUBSCRIBED") void refresh(); });
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); window.addEventListener("vardilo-chat-read", refresh);
    return () => { active = false; request++; window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("vardilo-chat-read", refresh); void supabase.removeChannel(channel); };
  }, [memberId, supabase]);
  if (!memberId || !unread) return null;
  return <aside className="chat-notification-banner" aria-label="Olästa meddelanden"><Link href="/chat"><span className="chat-unread-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span><span role="status">{unread === 1 ? "Du har ett oläst meddelande" : `Du har ${unread} olästa meddelanden`}</span><strong>Öppna chatten <span aria-hidden="true">›</span></strong></Link></aside>;
}
