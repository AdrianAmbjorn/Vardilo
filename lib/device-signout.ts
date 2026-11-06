import type { SupabaseClient } from "@supabase/supabase-js";

/** Stop delivery on this browser before discarding its authenticated session. */
export async function signOutOnThisDevice(
  supabase: Pick<SupabaseClient, "auth">,
  serviceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator
    ? navigator.serviceWorker : undefined,
) {
  const registration = await serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    const removed = await subscription.unsubscribe();
    // false may mean it was already removed. Confirm before discarding the session.
    if (!removed && await registration!.pushManager.getSubscription()) {
      throw new Error("Kunde inte stänga av enhetens pushnotiser. Försök logga ut igen.");
    }
  }
  const displayed = await registration?.getNotifications?.();
  displayed?.forEach(notification => notification.close());
  return supabase.auth.signOut({ scope: "local" });
}
