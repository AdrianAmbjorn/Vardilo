export function emailRequestError(code?: string): string {
  if (code === "email_address_not_authorized") return "Mejlutskicken behöver konfigureras av Vardilos administratör innan bekräftelsemejl kan skickas till den här adressen.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "Gränsen för mejlutskick är nådd. Vänta en stund innan du försöker igen.";
  if (code === "email_provider_disabled" || code === "signup_disabled") return "Registrering med e-post är inte tillgänglig just nu. Kontakta familjens Admin.";
  return "Det gick inte att begära mejlet. Kontrollera e-postadressen och försök igen.";
}

export function confirmationRedirect(origin: string, destination: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(destination)}`;
}

export function confirmationFailureUrl(origin: string, destination: string): string {
  return `${origin}/login?${new URLSearchParams({ error: "confirmation_link_invalid", next: destination })}`;
}
