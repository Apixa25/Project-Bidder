"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bootstrapEstimatorProfile,
  getDashboardPathForRole,
  getPostAuthPathForRole,
  parsePublicSignupRole,
  recordAccountIdentitySignals,
} from "@/lib/auth/account-setup";

async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const forwardedHost =
    headerStore.get("x-forwarded-host") || headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL!;
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const requestHeaders = await headers();

  const roleRaw = formData.get("role") as string;
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const password = formData.get("password") as string;
  const businessName = formData.get("businessName") as string | null;
  const tosAccepted = formData.get("tosAccepted") === "on";

  if (!roleRaw || !fullName || !email || !phone || !address || !password) {
    return { error: "All fields are required." };
  }

  if (!tosAccepted) {
    return { error: "Please accept the Terms of Service and Privacy Policy to continue." };
  }

  const role = parsePublicSignupRole(roleRaw);
  if (!role) {
    return { error: "Please select a valid account type." };
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
        business_name: businessName || null,
        phone,
        address,
      },
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (authData.user) {
    const admin = createAdminClient();
    const { error: profileError } = await admin.from("profiles").insert({
      user_id: authData.user.id,
      role,
      full_name: fullName,
      email,
      phone,
      address,
      business_name: businessName || null,
    });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      return { error: "Account created but profile setup failed. Please contact support." };
    }

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: authData.user.id,
      role,
    });

    if (roleError) {
      console.error("User role creation error:", roleError);
      return { error: "Account created but role setup failed. Please contact support." };
    }

    if (role === "bidder") {
      await admin.from("bidder_credentials").insert({
        user_id: authData.user.id,
      });
    }

    if (role === "estimator") {
      const estimatorSetup = await bootstrapEstimatorProfile({
        admin,
        userId: authData.user.id,
        fullName,
        businessName,
        email,
      });

      if (estimatorSetup.error) {
        return {
          error:
            "Account created but estimator profile setup failed. Please contact support.",
        };
      }
    }

    await recordAccountIdentitySignals({
      admin,
      userId: authData.user.id,
      email,
      phone,
      businessName,
      requestHeaders,
      source: "email_signup",
    });
  }

  const redirectPath = authData.user
    ? await getPostAuthPathForRole({
        admin: createAdminClient(),
        role,
        userId: authData.user.id,
      })
    : getDashboardPathForRole(role);

  redirect(redirectPath);
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const requestHeaders = await headers();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { data: loginData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("role, email, phone, business_name")
    .eq("user_id", loginData.user.id)
    .maybeSingle();

  if (!profile) {
    const metadata = loginData.user.user_metadata || {};
    const role = parsePublicSignupRole(metadata.role) || "customer";
    const fullName =
      typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name
        : loginData.user.email?.split("@")[0] || "User";
    const businessName =
      typeof metadata.business_name === "string" && metadata.business_name.trim()
        ? metadata.business_name
        : null;
    const phone = typeof metadata.phone === "string" ? metadata.phone : "";
    const address = typeof metadata.address === "string" ? metadata.address : "";

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: loginData.user.id,
      role,
      full_name: fullName,
      email: loginData.user.email || email,
      phone,
      address,
      business_name: businessName,
    });

    if (profileError) {
      console.error("Missing profile repair error:", profileError);
      return { error: "Account exists, but profile setup failed. Please contact support." };
    }

    await admin.from("user_roles").upsert(
      {
        user_id: loginData.user.id,
        role,
      },
      { onConflict: "user_id,role", ignoreDuplicates: true }
    );

    if (role === "bidder") {
      await admin.from("bidder_credentials").insert({
        user_id: loginData.user.id,
      });
    }

    if (role === "estimator") {
      await bootstrapEstimatorProfile({
        admin,
        userId: loginData.user.id,
        fullName,
        businessName,
        email: loginData.user.email || email,
      });
    }

    profile = {
      role,
      email: loginData.user.email || email,
      phone,
      business_name: businessName,
    };
  }

  if (profile?.role && loginData.user) {
    await supabase.from("user_roles").upsert(
      {
        user_id: loginData.user.id,
        role: profile.role,
      },
      { onConflict: "user_id,role", ignoreDuplicates: true }
    );

    if (profile.role === "estimator") {
      const metadata = loginData.user.user_metadata || {};
      const fullName =
        typeof metadata.full_name === "string" && metadata.full_name.trim()
          ? metadata.full_name
          : loginData.user.email?.split("@")[0] || "Estimator";
      const businessName =
        typeof profile.business_name === "string" && profile.business_name.trim()
          ? profile.business_name
          : typeof metadata.business_name === "string" && metadata.business_name.trim()
            ? metadata.business_name
            : null;

      await bootstrapEstimatorProfile({
        admin,
        userId: loginData.user.id,
        fullName,
        businessName,
        email: profile.email || loginData.user.email || email,
      });
    }

    await recordAccountIdentitySignals({
      userId: loginData.user.id,
      email: profile.email || email,
      phone: profile.phone,
      businessName: profile.business_name,
      requestHeaders,
      source: "login",
    });
  }

  const role = (profile?.role as UserRole | undefined) || "customer";
  const redirectPath = await getPostAuthPathForRole({
    admin,
    role,
    userId: loginData.user.id,
  });

  redirect(redirectPath);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signInWithGoogle(role?: string) {
  const supabase = await createClient();
  const baseUrl = await getRequestOrigin();
  const signupRole = parsePublicSignupRole(role);

  const redirectUrl = signupRole
    ? `${baseUrl}/auth/callback?role=${signupRole}`
    : `${baseUrl}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

// Sends a password reset email via Supabase Auth. The user clicks the link
// in the email, which goes through Supabase's verify endpoint and lands at
// our /auth/callback?next=/reset-password handler with a recovery code.
// The callback exchanges the code for a session and redirects to
// /reset-password where the user can set a new password.
//
// We deliberately ALWAYS return success (never reveal whether an email is
// registered) — this is a standard anti-enumeration practice. Supabase
// silently no-ops for unknown emails so this is also the actual behavior.
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const baseUrl = await getRequestOrigin();

  const email = (formData.get("email") as string | null)?.trim();

  if (!email) {
    return { error: "Please enter your email address." };
  }

  // Basic shape check — Supabase will validate properly on its side.
  if (!email.includes("@") || email.length < 5) {
    return { error: "Please enter a valid email address." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    // Log internally so we can debug delivery problems, but never leak the
    // reason to the user. Always return the same generic success response.
    console.error("Password reset request error:", error);
  }

  return { success: true };
}

// Updates the password of the currently authenticated user. The reset
// password flow lands here with a temporary recovery session created by
// /auth/callback after the email link is clicked. We require the user to
// be authenticated (otherwise the call would silently fail anyway) so we
// can give a clean error message instead of a Supabase auth error.
export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!password || !confirmPassword) {
    return { error: "Please fill in both password fields." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  // Supabase enforces a minimum of 6 characters by default; we require 8 to
  // match what we'd expect from any reasonable contractor/customer account.
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Your reset link has expired. Please request a new password reset email and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
