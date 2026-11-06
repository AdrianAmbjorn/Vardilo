// Bound the encoded JSON size for Web Push, preserving complete Unicode characters.
function preview(value: string, bytes: number): string {
 const encoder = new TextEncoder();
 let result = "", used = 0;
 for (const character of value) {
  const size = encoder.encode(JSON.stringify(character).slice(1, -1)).length;
  if (used + size > bytes - 3) return result + "…";
  result += character; used += size;
 }
 return result;
}
export function composePushPayload(id: string, title: string, body: string) {
 return { tag: id, title: preview(title || "Notis från Vardilo", 600), body: preview(body, 2400) };
}
