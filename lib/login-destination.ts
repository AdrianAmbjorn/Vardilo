export function loginDestination(search: string): string {
 const next=new URLSearchParams(search).get("next");
 return next && /^\/inbjudan\?kod=[a-f0-9]{64}$/.test(next) ? next : "/familj";
}

// Carry only the supported internal invitation, never arbitrary return URLs.
export function invitationContinuation(search: string, prefix = "?"): string {
 const destination = loginDestination(search);
 return destination.startsWith("/inbjudan?") ? `${prefix}${new URLSearchParams({ next: destination })}` : "";
}

export function recoveryDestination(search: string, failed = false): string {
 return `/losenord?${failed ? "error=expired" : "nytt=1"}${invitationContinuation(search, "&")}`;
}
