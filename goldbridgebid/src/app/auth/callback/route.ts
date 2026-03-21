import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { UserRole } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const roleRaw = searchParams.get("role") || "customer";
  const role: UserRole = roleRaw === "bidder" ? "bidder" : "customer";

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData.user) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", sessionData.user.id)
        .single();

      if (!existingProfile) {
        await supabase.from("profiles").insert({
          user_id: sessionData.user.id,
          role,
          full_name:
            sessionData.user.user_metadata?.full_name ||
            sessionData.user.email?.split("@")[0] ||
            "User",
          email: sessionData.user.email || "",
          phone: "",
          address: "",
        });

        if (role === "bidder") {
          await supabase.from("bidder_credentials").insert({
            user_id: sessionData.user.id,
          });
        }
      }

      const redirectPath = role === "bidder" ? "/bidder" : "/customer";
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
