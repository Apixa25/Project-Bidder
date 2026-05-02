"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bootstrapEstimatorProfile,
  getDashboardPathForRole,
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

  if (!roleRaw || !fullName || !email || !phone || !address || !password) {
    return { error: "All fields are required." };
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
      },
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (authData.user) {
    const admin = createAdminClient();
    const { error: profileError } = await supabase.from("profiles").insert({
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

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: authData.user.id,
      role,
    });

    if (roleError) {
      console.error("User role creation error:", roleError);
      return { error: "Account created but role setup failed. Please contact support." };
    }

    if (role === "bidder") {
      await supabase.from("bidder_credentials").insert({
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

  redirect(getDashboardPathForRole(role));
}

export async function login(formData: FormData) {
  const supabase = await createClient();
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, phone, business_name")
    .eq("user_id", loginData.user.id)
    .single();

  if (profile?.role && loginData.user) {
    await supabase.from("user_roles").upsert(
      {
        user_id: loginData.user.id,
        role: profile.role,
      },
      { onConflict: "user_id,role", ignoreDuplicates: true }
    );

    await recordAccountIdentitySignals({
      userId: loginData.user.id,
      email: profile.email || email,
      phone: profile.phone,
      businessName: profile.business_name,
      requestHeaders,
      source: "login",
    });
  }

  redirect(getDashboardPathForRole((profile?.role as UserRole | undefined) || "customer"));
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
