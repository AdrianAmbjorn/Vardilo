import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { childLoginEmail, normalizeChildUsername, validChildUsername } from "./identity.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response({ error: "Metoden stöds inte." }, 405);
  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Logga in som förälder först." }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user?.email) return response({ error: "Logga in som förälder först." }, 401);
    const raw = await request.json();
    const { memberId, password, action } = raw;
    if (typeof memberId !== "string" || !/^[0-9a-f-]{36}$/i.test(memberId) || typeof password !== "string" || password.length < 10 || password.length > 128 || !["create", "reset"].includes(action)) return response({ error: "Välj ett lösenord på 10–128 tecken." }, 400);
    const { data: guardian, error: guardianError } = await admin.from("family_members").select("id,family_id,role").eq("user_id", auth.user.id).single();
    if (guardianError || !guardian || !["admin", "förälder"].includes(guardian.role)) return response({ error: "Endast föräldrar med rätt behörighet kan hantera barnkonton." }, 403);
    const { data: permission } = await admin.from("family_permissions").select("can_manage_members").eq("family_member_id", guardian.id).maybeSingle();
    if (!permission?.can_manage_members) return response({ error: "Du saknar behörighet att hantera familjemedlemmar." }, 403);
    const { data: child, error: childError } = await admin.from("family_members").select("id,display_name,role,user_id").eq("id", memberId).eq("family_id", guardian.family_id).eq("role", "barn").single();
    if (childError || !child) return response({ error: "Barnprofilen kunde inte hittas i din familj." }, 403);
    if (action === "reset") {
      const { data: login } = await admin.from("family_child_logins").select("child_user_id").eq("member_id", child.id).eq("guardian_user_id", auth.user.id).single();
      if (!login || login.child_user_id !== child.user_id) return response({ error: "Kontot måste hanteras av föräldern som kopplade det." }, 403);
      const { error } = await admin.auth.admin.updateUserById(login.child_user_id, { password });
      if (error) return response({ error: "Kunde inte ändra lösenordet. Försök igen." }, 400);
      return response({ message: "Barnets lösenord är ändrat." });
    }
    if (child.user_id) return response({ error: "Barnet har redan en inloggning." }, 409);
    const username = typeof raw.username === "string" ? normalizeChildUsername(raw.username) : "";
    if (!validChildUsername(username)) return response({ error: "Användarnamnet ska vara 3–30 tecken: a–z, siffror, bindestreck eller understreck." }, 400);
    const parentEmail = auth.user.email.trim().toLowerCase();
    const email = await childLoginEmail(parentEmail, username);
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { parent_managed_child: true }, user_metadata: { display_name: child.display_name } });
    if (createError || !created.user) return response({ error: "Kunde inte skapa inloggningen. Användarnamnet kan redan vara upptaget – prova ett annat." }, 400);
    const { error: linkError } = await admin.rpc("link_parent_managed_child", { p_member_id: child.id, p_child_user_id: created.user.id, p_guardian_user_id: auth.user.id, p_parent_email: parentEmail, p_username: username });
    if (linkError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return response({ error: "Kunde inte koppla inloggningen. Ladda om familjen och försök igen." }, 409);
    }
    return response({ message: "Barnets inloggning är skapad.", username, parentEmail });
  } catch {
    return response({ error: "Kunde inte slutföra ändringen. Kontrollera kontots status innan du försöker igen." }, 500);
  }
});
