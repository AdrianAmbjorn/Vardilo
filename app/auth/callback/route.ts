import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Bekräftelselänken saknar en giltig kod.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Bekräftelselänken är ogiltig eller har gått ut. Begär en ny bekräftelselänk.")}`,
    );
  }

  const destination = next && next.startsWith("/") ? next : "/familj";
  return NextResponse.redirect(`${origin}${destination}`);
}
