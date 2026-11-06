import { NextRequest, NextResponse } from "next/server";
import { loginDestination, recoveryDestination } from "@/lib/login-destination";
import { confirmationFailureUrl } from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const recovery = searchParams.get("flow") === "recovery";
  const destination = recovery ? recoveryDestination(searchParams.toString()) : loginDestination(searchParams.toString());

  if (!code) {
    return NextResponse.redirect(
      recovery ? `${origin}${recoveryDestination(searchParams.toString(), true)}` : confirmationFailureUrl(origin, destination),
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        recovery ? `${origin}${recoveryDestination(searchParams.toString(), true)}` : confirmationFailureUrl(origin, destination),
      );
    }

    return NextResponse.redirect(`${origin}${destination}`);
  } catch {
    return NextResponse.redirect(recovery ? `${origin}${recoveryDestination(searchParams.toString(), true)}` : confirmationFailureUrl(origin, destination));
  }
}
