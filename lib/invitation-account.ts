import type { SupabaseClient } from "@supabase/supabase-js";

// A missing session is normal for a newly invited person; a failed request is not.
export async function invitationAccount(auth: Pick<SupabaseClient["auth"], "getUser">): Promise<string | null> {
  const { data, error } = await auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user?.email ?? null;
}
