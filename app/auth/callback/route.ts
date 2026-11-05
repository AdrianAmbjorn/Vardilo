import { NextRequest, NextResponse } from "next/server";
import { loginDestination } from "@/lib/login-destination";
import { confirmationFailureUrl } from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const recovery = searchParams.get("flow") === "recovery";
  const destination = recovery ? "/losenord?nytt=1" : loginDestination(searchParams.toString());

  if (!code) {
    return NextResponse.redirect(
      recovery ? `${origin}/losenord?error=expired` : confirmationFailureUrl(origin, destination),
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        recovery ? `${origin}/losenord?error=expired` : confirmationFailureUrl(origin, destination),
      );
    }

    return NextResponse.redirect(`${origin}${destination}`);
  } catch {
    return NextResponse.redirect(recovery ? `${origin}/losenord?error=expired` : confirmationFailureUrl(origin, destination));
  }
}
