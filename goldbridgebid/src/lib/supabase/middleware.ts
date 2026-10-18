import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const BAN_CHECK_COOKIE = "x-ban-checked";
const BAN_CHECK_TTL_SECONDS = 60;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/auth/callback") ||
    request.nextUrl.pathname.startsWith("/banned") ||
    request.nextUrl.pathname.startsWith("/terms") ||
    request.nextUrl.pathname.startsWith("/privacy") ||
    request.nextUrl.pathname.startsWith("/how-it-works") ||
    request.nextUrl.pathname.startsWith("/address-quotes") ||
    request.nextUrl.pathname.startsWith("/api/address-quotes") ||
    request.nextUrl.pathname === "/manifest.json" ||
    request.nextUrl.pathname === "/sw.js";

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isPublicRoute) {
    const banCacheCookie = request.cookies.get(BAN_CHECK_COOKIE)?.value;
    const skipBanCheck = banCacheCookie === user.id;

    if (!skipBanCheck) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("user_id", user.id)
        .single();

      if (profile?.is_banned) {
        const url = request.nextUrl.clone();
        url.pathname = "/banned";
        return NextResponse.redirect(url);
      }

      supabaseResponse.cookies.set(BAN_CHECK_COOKIE, user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: BAN_CHECK_TTL_SECONDS,
        path: "/",
      });
    }
  }

  return supabaseResponse;
}
