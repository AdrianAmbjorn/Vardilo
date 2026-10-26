import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  if (!tokenHash || type !== "email") {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Bekräftelselänken är ogiltig eller ofullständig.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Bekräftelselänken är ogiltig eller har gått ut. Begär en ny bekräftelselänk.")}`,
    );
  }

  const destination = next && next.startsWith("/") ? next : "/familj";
  return NextResponse.redirect(`${origin}${destination}`);
}
