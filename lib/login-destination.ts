export function loginDestination(search: string): string {
 const next=new URLSearchParams(search).get("next");
 return next && /^\/inbjudan\?kod=[a-f0-9]{64}$/.test(next) ? next : "/familj";
}
