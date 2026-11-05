export type InvitationDates = { expires_at: string; accepted_at: string | null; revoked_at: string | null };
export type InvitationStatus = "accepted" | "revoked" | "expired" | "pending";

export function invitationStatus(invitation: InvitationDates, now = Date.now()): InvitationStatus {
  if (invitation.accepted_at) return "accepted";
  if (invitation.revoked_at) return "revoked";
  const expires = Date.parse(invitation.expires_at);
  if (!Number.isFinite(expires) || expires <= now) return "expired";
  return "pending";
}

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  accepted: "Accepterad", revoked: "Återkallad", expired: "Utgången", pending: "Väntar på svar",
};
