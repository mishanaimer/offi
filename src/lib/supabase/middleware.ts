import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const isAuthRoute = url.pathname.startsWith("/login") || url.pathname.startsWith("/register");
  const isProtected =
    url.pathname.startsWith("/chat") ||
    url.pathname.startsWith("/knowledge") ||
    url.pathname.startsWith("/clients") ||
    url.pathname.startsWith("/documents") ||
    url.pathname.startsWith("/team") ||
    url.pathname.startsWith("/settings") ||
    url.pathname.startsWith("/onboarding");

  if (!user && isProtected) {
    const redirectUrl = url.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", url.pathname);
    return NextResponse.redirect(redirectUrl);
  }
  if (user && isAuthRoute) {
    const redirectUrl = url.clone();
    redirectUrl.pathname = "/chat";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
