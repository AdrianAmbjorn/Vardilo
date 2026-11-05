import { NextRequest, NextResponse } from "next/server";
import { loginDestination } from "@/lib/login-destination";
import { confirmationFailureUrl } from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const destination = loginDestination(searchParams.toString());

  if (!code) {
    return NextResponse.redirect(
      confirmationFailureUrl(origin, destination),
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        confirmationFailureUrl(origin, destination),
      );
    }

    return NextResponse.redirect(`${origin}${destination}`);
  } catch {
    return NextResponse.redirect(confirmationFailureUrl(origin, destination));
  }
}
