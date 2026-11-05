export function normalizeChildUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validChildUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{2,29}$/.test(normalizeChildUsername(value));
}

// An internal Auth identifier; no mail is sent to this address.
export async function childLoginEmail(parentEmail: string, username: string): Promise<string> {
  const identity = JSON.stringify([parentEmail.trim().toLowerCase(), normalizeChildUsername(username)]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex}@children.vardilo.invalid`;
}
