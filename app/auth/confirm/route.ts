import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { loginDestination, recoveryDestination } from "@/lib/login-destination";
import { confirmationFailureUrl } from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const recovery = type === "recovery";
  const destination = recovery ? recoveryDestination(searchParams.toString()) : loginDestination(searchParams.toString());

  if (!tokenHash || (type !== "email" && type !== "recovery")) {
    return NextResponse.redirect(
      recovery ? `${origin}${recoveryDestination(searchParams.toString(), true)}` : confirmationFailureUrl(origin, destination),
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

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
