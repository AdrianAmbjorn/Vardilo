const sections = new Set(["/", "/notiser", "/chat", "/kalender", "/listor", "/uppgifter", "/hjalp", "/check-in", "/onskelistor", "/profil", "/familj", "/budget", "/sparande"]);

export function notificationDestination(href: string | null, startsAt?: unknown): string | null {
 if (!href) return null;
 if (href === "/kalender" && typeof startsAt === "string") {
  const date = new Date(startsAt);
  if (Number.isFinite(date.getTime())) return `/kalender?datum=${encodeURIComponent(date.toISOString())}`;
 }
 if (sections.has(href)) return href;
 if (/^\/listor\?lista=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(href)) return href;
 return null;
}
