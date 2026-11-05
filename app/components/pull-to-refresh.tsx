"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const threshold = 72;

function canStart(target: EventTarget | null) {
  if (!(target instanceof Element) || window.scrollY > 0) return false;
  if (document.querySelector('[role="dialog"], dialog[open], .calendar-modal-backdrop')) return false;
  if (target.closest("input, textarea, select, button, a, form, [contenteditable=true]")) return false;
  if (document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) return false;
  for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
    const overflow = getComputedStyle(element).overflowY;
    if (/(auto|scroll)/.test(overflow) && element.scrollHeight > element.clientHeight) return false;
  }
  return !window.getSelection()?.toString();
}

export default function PullToRefresh() {
  const pathname = usePathname();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    let pulled = 0;
    let locked = false;

    function cancel() {
      start = null;
      pulled = 0;
      setDistance(0);
    }

    function onStart(event: TouchEvent) {
      cancel();
      if (locked || event.touches.length !== 1 || !canStart(event.target)) return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }

    function onMove(event: TouchEvent) {
      if (!start) return;
      if (event.touches.length !== 1 || window.scrollY > 0) { cancel(); return; }
      const dy = event.touches[0].clientY - start.y;
      const dx = Math.abs(event.touches[0].clientX - start.x);
      if (dy < 0 || dx > Math.max(10, dy)) { cancel(); return; }
      if (dy < 10) return;
      if (!event.cancelable) { cancel(); return; }
      event.preventDefault();
      pulled = Math.min(96, dy * 0.5);
      setDistance(pulled);
    }

    function onEnd() {
      const shouldRefresh = pulled >= threshold && !locked;
      cancel();
      if (shouldRefresh) {
        locked = true;
        setRefreshing(true);
        window.location.reload();
      }
    }

    setRefreshing(false);
    setDistance(0);
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", cancel);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", cancel);
    };
  }, [pathname]);

  return (
    <>
      <style>{`
        @media (pointer: coarse) {
          html, body { overscroll-behavior-y: contain; }
        }
      `}</style>
      {(distance > 0 || refreshing) && (
        <div
          role="status"
          style={{
            position: "fixed", top: "max(10px, env(safe-area-inset-top))", left: "50%",
            transform: "translateX(-50%)", zIndex: 100,
            padding: "10px 16px", borderRadius: 24, background: "var(--surface)",
            color: "var(--text)", boxShadow: "var(--shadow)", border: "1px solid var(--line)",
            pointerEvents: "none", whiteSpace: "nowrap", fontSize: 13,
          }}
        >
          {refreshing ? "Uppdaterar…" : distance >= threshold ? "Släpp för att uppdatera" : "Dra ned för att uppdatera"}
        </div>
      )}
    </>
  );
}
