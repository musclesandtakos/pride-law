import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectWithCookies(response: NextResponse, location: URL) {
  const redirect = NextResponse.redirect(location);

  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }

  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const publicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (!user && !publicPath) {
    return redirectWithCookies(response, new URL("/login", request.url));
  }

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
    const isActive = profile?.status === "active";

    if (!isActive && !publicPath) {
      await supabase.auth.signOut();
      return redirectWithCookies(response, new URL("/login?error=Account%20is%20not%20active", request.url));
    }

    if (isActive && pathname === "/login") {
      return redirectWithCookies(response, new URL("/", request.url));
    }
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
