export function wishUrl(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`); }
  catch { throw new Error("Kontrollera länken till önskningen."); }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("Använd en vanlig webblänk utan inloggningsuppgifter.");
  }
  return url.href;
}

export function wishPrice(value: string): number | null {
  const input = value.replace(/[\s\u00a0\u202f]/g, "");
  if (!input) return null;
  if (!/^\d{1,8}([,.]\d{1,2})?$/.test(input)) throw new Error("Skriv priset i kronor, till exempel 299 eller 299,50.");
  return Number(input.replace(",", "."));
}

export function safeWishUrl(value: string | null): string | null {
  try { return wishUrl(value ?? ""); } catch { return null; }
}

export function formatWishPrice(value: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 2 }).format(value);
}
