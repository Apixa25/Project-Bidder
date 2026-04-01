"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

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

  const roleRaw = formData.get("role") as string;
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const password = formData.get("password") as string;

  if (!roleRaw || !fullName || !email || !phone || !address || !password) {
    return { error: "All fields are required." };
  }

  if (roleRaw !== "customer" && roleRaw !== "bidder") {
    return { error: "Please select a valid account type." };
  }

  const role: UserRole = roleRaw;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
      },
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (authData.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: authData.user.id,
      role,
      full_name: fullName,
      email,
      phone,
      address,
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
  }

  redirect(role === "customer" ? "/customer" : "/bidder");
}

export async function login(formData: FormData) {
  const supabase = await createClient();

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
    .select("role")
    .single();

  if (profile?.role && loginData.user) {
    await supabase.from("user_roles").upsert(
      {
        user_id: loginData.user.id,
        role: profile.role,
      },
      { onConflict: "user_id,role", ignoreDuplicates: true }
    );
  }

  if (profile?.role === "admin") {
    redirect("/admin");
  } else if (profile?.role === "bidder") {
    redirect("/bidder");
  } else {
    redirect("/customer");
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signInWithGoogle(role?: string) {
  const supabase = await createClient();
  const baseUrl = await getRequestOrigin();

  const redirectUrl = role
    ? `${baseUrl}/auth/callback?role=${role}`
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
