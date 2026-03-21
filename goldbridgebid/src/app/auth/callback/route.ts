import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { UserRole } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const roleRaw = searchParams.get("role");
  const signupRole: UserRole | null =
    roleRaw === "bidder" ? "bidder" : roleRaw === "customer" ? "customer" : null;

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData.user) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", sessionData.user.id)
        .single();

      if (existingProfile) {
        // Existing user — redirect based on their STORED role
        const storedRole = existingProfile.role as UserRole;
        const redirectPath =
          storedRole === "admin"
            ? "/admin"
            : storedRole === "bidder"
              ? "/bidder"
              : "/customer";
        return NextResponse.redirect(`${origin}${redirectPath}`);
      }

      // New user — create profile with the role from signup
      const role: UserRole = signupRole || "customer";

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

      const redirectPath = role === "bidder" ? "/bidder" : "/customer";
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
