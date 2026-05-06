import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { UserRole } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bootstrapEstimatorProfile,
  getPostAuthPathForRole,
  parsePublicSignupRole,
  recordAccountIdentitySignals,
} from "@/lib/auth/account-setup";

// Returns the value of `?next=...` if it's a safe internal redirect target.
// Only single-leading-slash paths are allowed. This prevents open-redirect
// attacks where someone crafts a link like
// /auth/callback?code=xxx&next=https://evil.example.com .
function safeInternalNext(rawNext: string | null): string | null {
  if (!rawNext) return null;
  if (!rawNext.startsWith("/")) return null;
  // Reject protocol-relative URLs like //evil.example.com which the browser
  // would treat as cross-origin.
  if (rawNext.startsWith("//")) return null;
  return rawNext;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const roleRaw = searchParams.get("role");
  const signupRole = parsePublicSignupRole(roleRaw);
  // The `next` param lets specific flows (currently: password reset) hop
  // through the callback to a follow-up page once the session is created.
  const nextPath = safeInternalNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: sessionData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData.user) {
      // Password reset flow: skip all the role-based dashboard routing and
      // drop the user directly at the requested follow-up page (with the
      // freshly-created recovery session attached). They'll set a new
      // password there and we'll redirect them onward from that form.
      if (nextPath) {
        return NextResponse.redirect(`${origin}${nextPath}`);
      }

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", sessionData.user.id)
        .single();

      if (existingProfile) {
        await supabase.from("user_roles").upsert(
          {
            user_id: sessionData.user.id,
            role: existingProfile.role as UserRole,
          },
          { onConflict: "user_id,role", ignoreDuplicates: true }
        );

        if (existingProfile.role === "estimator") {
          await bootstrapEstimatorProfile({
            admin,
            userId: sessionData.user.id,
            fullName: existingProfile.full_name,
            businessName: existingProfile.business_name,
            email: existingProfile.email,
          });
        }

        await recordAccountIdentitySignals({
          admin,
          userId: sessionData.user.id,
          email: existingProfile.email,
          phone: existingProfile.phone,
          businessName: existingProfile.business_name,
          requestHeaders: request.headers,
          source: "login",
        });

        // Existing user — redirect based on their STORED role
        const storedRole = existingProfile.role as UserRole;
        const redirectPath = await getPostAuthPathForRole({
          admin,
          role: storedRole,
          userId: sessionData.user.id,
        });

        return NextResponse.redirect(`${origin}${redirectPath}`);
      }

      // New user — create profile with the role from signup
      const role: UserRole = signupRole || "customer";

      await admin.from("profiles").insert({
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

      await admin.from("user_roles").upsert(
        {
          user_id: sessionData.user.id,
          role,
        },
        { onConflict: "user_id,role", ignoreDuplicates: true }
      );

      if (role === "bidder") {
        await admin.from("bidder_credentials").insert({
          user_id: sessionData.user.id,
        });
      }

      if (role === "estimator") {
        await bootstrapEstimatorProfile({
          admin,
          userId: sessionData.user.id,
          fullName:
            sessionData.user.user_metadata?.full_name ||
            sessionData.user.email?.split("@")[0] ||
            "User",
          email: sessionData.user.email,
        });
      }

      await recordAccountIdentitySignals({
        admin,
        userId: sessionData.user.id,
        email: sessionData.user.email,
        requestHeaders: request.headers,
        source: "oauth_signup",
      });

      const redirectPath = await getPostAuthPathForRole({
        admin,
        role,
        userId: sessionData.user.id,
      });

      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
