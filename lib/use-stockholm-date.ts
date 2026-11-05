"use client";
import { useEffect, useState } from "react";
import { stockholmDate } from "./daily-tasks";
export function useStockholmDate() {
  const [today, setToday] = useState(() => stockholmDate());
  useEffect(() => {
    const update = () => setToday(stockholmDate());
    const timer = window.setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update); window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); window.removeEventListener("focus", update); };
  }, []);
  return today;
}
