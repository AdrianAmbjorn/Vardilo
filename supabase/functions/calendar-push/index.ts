import { createClient } from "npm:@supabase/supabase-js@2.106.2";
// @ts-types="npm:@types/web-push@3.6.4"
import webPush from "npm:web-push@3.6.7";
import { composePushPayload } from "./payload.ts";

type Delivery = { notification_id: string; endpoint: string; p256dh: string; auth_key: string };

const hosts = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);

function isPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && !url.username && !url.password &&
      (hosts.has(url.hostname) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname));
  } catch {
    return false;
  }
}

Deno.serve(async request => {
  const token = request.headers.get("x-vardilo-push-token");
  if (request.method !== "POST" || !token) return new Response(null, { status: 401 });

  const database = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: keys, error: configError } = await database.rpc("calendar_push_config", { worker_token: token });
  if (configError) return new Response(null, { status: 500 });
  if (!keys) return new Response(null, { status: 401 });

  const { data, error } = await database.rpc("claim_calendar_push");
  if (error) return new Response(null, { status: 500 });

  const deliveries = (data ?? []) as Delivery[];
  async function deliver(delivery: Delivery) {
    let finished = true;
    if (isPushEndpoint(delivery.endpoint)) {
      try {
        const { data: notification, error: contentError } = await database.from("notifications")
          .select("title,body,type,metadata,family_id").eq("id", delivery.notification_id).is("read_at", null).maybeSingle();
        if (contentError) throw contentError;
        let text = notification?.body ?? "";
        let available = Boolean(notification);
        if (notification?.type === "chat") {
          const { data: message, error: messageError } = await database.from("family_chat_messages")
            .select("body").eq("id", notification.metadata?.message_id).eq("family_id", notification.family_id).maybeSingle();
          if (messageError) throw messageError;
          available = Boolean(message); text = message?.body ?? "";
        }
        if (available) await webPush.sendNotification(
          { endpoint: delivery.endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth_key } },
          JSON.stringify(composePushPayload(delivery.notification_id, notification!.title, text)),
          { vapidDetails: { subject: "https://vardilo.vercel.app/", publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60, timeout: 5000 }
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          const { error } = await database.from("calendar_push_subscriptions").delete().eq("endpoint", delivery.endpoint);
          return !error;
        }
        finished = status !== undefined && status < 500 && status !== 429;
      }
    }
    if (!finished) return false;
    const { error } = await database.from("calendar_push_deliveries").update({ finished: true })
      .eq("notification_id", delivery.notification_id).eq("endpoint", delivery.endpoint);
    return !error;
  }

  let completed = 0;
  for (let index = 0; index < deliveries.length; index += 10) {
    const results = await Promise.all(deliveries.slice(index, index + 10).map(deliver));
    completed += results.filter(Boolean).length;
  }
  return Response.json({ claimed: deliveries.length, completed });
});
