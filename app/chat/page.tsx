"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFamilyProfilePhotos } from "@/lib/use-family-profile-photos";

type Member = { id: string; display_name: string };
type Message = { id: string; member_id: string; body: string; announcement_title?: string | null; created_at: string };

const dayLabel = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric" });
const timeLabel = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" });

export default function ChatPage() {
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState<(Member & { family_id: string }) | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messageLoadError, setMessageLoadError] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const thread = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const messageRequest = useRef(0);
  const familyId = member?.family_id;
  const profilePhotos = useFamilyProfilePhotos(supabase, familyId);

  const loadMessages = useCallback(async (id: string) => {
    const request = ++messageRequest.current;
    try {
    const { data, error } = await supabase.from("family_chat_messages")
      .select("id,member_id,body,announcement_title,created_at").eq("family_id", id)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (request !== messageRequest.current) return;
    if (error) setMessageLoadError("Kunde inte läsa meddelandena.");
    else { setMessages((data ?? []).reverse()); setMessageLoadError(""); }
    } catch {
      if (request === messageRequest.current) setMessageLoadError("Kunde inte läsa meddelandena. Försök igen.");
    } finally { if (request === messageRequest.current) setLoading(false); }
  }, [supabase]);

  useEffect(() => {
    async function load() {
      try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError && authError.name !== "AuthSessionMissingError") throw authError;
      if (!auth.user) {
        setError("Logga in för att öppna familjechatten.");
        setLoading(false);
        return;
      }
      const { data, error: memberError } = await supabase.from("family_members")
        .select("id,family_id,display_name").eq("user_id", auth.user.id).maybeSingle();
      if (memberError) throw memberError;
      if (!data) {
        setError("Kunde inte hitta din familj.");
        setLoading(false);
        return;
      }
      setMember(data);
      const { data: family, error: familyError } = await supabase.from("family_members")
        .select("id,display_name").eq("family_id", data.family_id);
      if (familyError) throw familyError;
      setMembers(family ?? []);
      } catch { setError("Kunde inte öppna chatten. Ladda om och försök igen."); setLoading(false); }
    }
    void load();
  }, [supabase]);

  useEffect(() => {
    if (!familyId) return;
    void loadMessages(familyId);
    const channel = supabase.channel(`family-chat-${familyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "family_chat_messages", filter: `family_id=eq.${familyId}` },
        () => void loadMessages(familyId))
      .subscribe(status => { if (status === "SUBSCRIBED") void loadMessages(familyId); });
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void loadMessages(familyId);
    };
    const timer = window.setInterval(refreshVisible, 15_000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      messageRequest.current++;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      void supabase.removeChannel(channel);
    };
  }, [familyId, loadMessages, supabase]);

  useEffect(() => {
    const panel = thread.current;
    if (panel && followLatest.current) panel.scrollTop = panel.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!member || !messages.length || loading) return;
    let active = true;
    const markVisibleRead = async () => {
      if (document.visibilityState !== "visible") return;
      const ids = messages.filter(message => message.member_id !== member.id).map(message => message.id);
      if (!ids.length) return;
      try {
        const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
          .eq("recipient_member_id", member.id).eq("type", "chat").is("read_at", null).in("metadata->>message_id", ids);
        if (!error && active) window.dispatchEvent(new Event("vardilo-chat-read"));
      } catch { /* Leave messages unread if the acknowledgement cannot be saved. */ }
    };
    void markVisibleRead();
    document.addEventListener("visibilitychange", markVisibleRead);
    return () => { active = false; document.removeEventListener("visibilitychange", markVisibleRead); };
  }, [member, messages, loading, supabase]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || (!isAnnouncement && !body.trim()) || sending) return;
    if (isAnnouncement && (!announcementTitle.trim() || announcementTitle.trim().length > 140)) { setError("Skriv en rubrik på högst 140 tecken."); return; }
    setSending(true);
    setError("");
    try {
      const { error } = await supabase.from("family_chat_messages")
        .insert({ family_id: member.family_id, member_id: member.id, body: body.trim(), ...(isAnnouncement ? { announcement_title: announcementTitle.trim() } : {}) });
      if (error) {
        setError("Kunde inte skicka. Ditt meddelande finns kvar.");
        return;
      }
      followLatest.current = true;
      setBody(""); setAnnouncementTitle(""); setIsAnnouncement(false);
      await loadMessages(member.family_id);
    } catch {
      setError("Kunde inte bekräfta att meddelandet skickades. Kontrollera chatten innan du försöker igen.");
    } finally {
      setSending(false);
    }
  }

  async function removeMessage(message: Message) {
    if (!member || message.member_id !== member.id || removingId ||
        !window.confirm("Ta bort meddelandet för hela familjen?")) return;
    setRemovingId(message.id);
    setError("");
    try {
      const { error } = await supabase.from("family_chat_messages").delete()
        .eq("id", message.id).eq("family_id", member.family_id).eq("member_id", member.id)
        .select("id").maybeSingle();
      if (error) throw error;
      messageRequest.current++;
      setMessages(current => current.filter(item => item.id !== message.id));
    } catch {
      setError("Kunde inte ta bort meddelandet. Försök igen.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="section-shell family-chat-page">
      <style>{`
        .family-chat-page .section-header { grid-template-columns: minmax(0, 1fr) auto; }
        .chat-announcement { max-width: 100%; width: min(100%, 680px); padding: 16px; border: 1px solid var(--accent); border-radius: 18px; background: var(--accent-soft); }
        .chat-announcement h2 { margin: 4px 0 10px; font-size: 22px; line-height: 1.3; overflow-wrap: anywhere; color: var(--text); }
        .chat-announcement .chat-bubble { background: transparent !important; color: var(--text) !important; padding: 0; }
        .chat-announcement-editor { display: grid; gap: 10px; padding: 12px; border-top: 1px solid var(--line); }
        .chat-announcement-editor input { width: 100%; min-width: 0; min-height: 44px; font-size: 16px; padding: 10px; }
        .chat-thread { height: clamp(240px, 58dvh, 580px); overflow-y: auto; padding: 16px; }
        .chat-day { text-align: center; color: var(--muted); font-size: 12px; margin: 14px 0; }
        .chat-line { display: flex; align-items: flex-end; gap: 8px; margin: 0 0 10px; }
        .chat-line-own { justify-content: flex-end; }
        .chat-line .avatar { overflow: hidden; margin-bottom: 16px; }
        .chat-line .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chat-message { min-width: 0; max-width: min(79%, 560px); display: grid; justify-items: start; gap: 3px; }
        .chat-line-own .chat-message { justify-items: end; }
        .chat-message-meta { display: flex; align-items: center; gap: 4px; }
        .chat-remove { border: 0; background: transparent; color: var(--muted); padding: 4px 6px; font-size: 11px; text-decoration: underline; }
        .chat-sender, .chat-time { color: var(--muted); font-size: 11px; padding-inline: 5px; }
        .chat-bubble { margin: 0; padding: 8px 13px; border-radius: 18px 18px 18px 5px; background: #ebedf1; color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; }
        .chat-line-own .chat-bubble { border-radius: 18px 18px 5px 18px; background: #0065cf; color: #fff; }
        .chat-composer { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); }
        .chat-composer input { flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 24px; font-size: 16px; }
        .chat-composer button { border-radius: 24px; min-height: 44px; }
        .chat-composer button:disabled { opacity: .55; }
        @media (max-width: 600px) {
          .family-chat-page { padding: 22px 12px; }
          .chat-thread { padding: 12px 10px; }
        }
      `}</style>
      <header className="section-header">
        <div><p className="eyebrow">VARDILO</p><h1>Familjechatten</h1></div>
        <Link className="secondary" href="/">Hem</Link>
      </header>
      <section className="section-card">
        <div className="chat-thread" ref={thread} role="log" aria-label="Meddelanden" tabIndex={0} onScroll={event => {
          const panel = event.currentTarget;
          followLatest.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 80;
        }}>
          {loading && <p className="muted">Laddar meddelanden…</p>}
          {!loading && !error && !messages.length && <p className="muted">Inga meddelanden ännu.</p>}
          {messages.map((message, index) => {
            const sender = members.find(person => person.id === message.member_id);
            const own = message.member_id === member?.id;
            const date = new Date(message.created_at);
            const day = dayLabel.format(date);
            const previous = messages[index - 1];
            const photo = profilePhotos[message.member_id];
            return (
              <Fragment key={message.id}>
                {(!previous || dayLabel.format(new Date(previous.created_at)) !== day) && <p className="chat-day">{day}</p>}
                <div className={own ? "chat-line chat-line-own" : "chat-line"}>
                  {!own && <span className="avatar" aria-hidden="true">{photo ? <img src={photo} alt="" /> : sender?.display_name.trim().charAt(0).toLocaleUpperCase("sv-SE") || "?"}</span>}
                  <div className={message.announcement_title ? "chat-message chat-announcement" : "chat-message"}>
                    <strong className="chat-sender">{own ? "Du" : sender?.display_name ?? "Familjemedlem"}</strong>
                    {message.announcement_title && <><span className="chat-sender">🎉 Stort meddelande</span><h2>{message.announcement_title}</h2></>}
                    {message.body && <p className="chat-bubble">{message.body}</p>}
                    <div className="chat-message-meta">
                      <time className="chat-time" dateTime={message.created_at}>{timeLabel.format(date)}</time>
                      {own && <button type="button" className="chat-remove" disabled={removingId !== null} onClick={() => void removeMessage(message)}>
                        {removingId === message.id ? "Tar bort…" : "Ta bort"}
                      </button>}
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
        {(error || messageLoadError) && <p className="section-row" role="alert">{error || messageLoadError}</p>}
        <div className="chat-announcement-editor">
          <label><input type="checkbox" style={{width:20,minHeight:20,marginRight:8}} checked={isAnnouncement} disabled={sending || !member} onChange={event=>setIsAnnouncement(event.target.checked)} />Stort meddelande till hela familjen</label>
          {isAnnouncement && <><label>Rubrik<input value={announcementTitle} maxLength={140} disabled={sending} placeholder="T.ex. Jag har fått nytt jobb!" onChange={event=>setAnnouncementTitle(event.target.value)} /></label><small>Alla i familjen får en notis, även du. Push kräver att mottagarens enhet har push påslaget.</small></>}
        </div>
        <form className="chat-composer" onSubmit={send}>
          <input aria-label={isAnnouncement ? "Tilläggstext (valfritt)" : "Meddelande"} value={body} onChange={event => setBody(event.target.value)} placeholder={isAnnouncement ? "Tilläggstext (valfritt)" : "Skriv ett meddelande"} disabled={sending || !member} />
          <button className="primary" type="submit" disabled={sending || !member || (isAnnouncement ? !announcementTitle.trim() : !body.trim())}>{sending ? "Skickar…" : isAnnouncement ? "Publicera" : "Skicka"}</button>
        </form>
      </section>
    </main>
  );
}
