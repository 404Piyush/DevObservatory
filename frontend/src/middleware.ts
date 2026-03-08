import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const access = req.cookies.get("access_token")?.value;
  const { pathname } = req.nextUrl;

  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isProtected =
    pathname === "/dashboard" ||
    pathname === "/projects" ||
    pathname === "/events" ||
    pathname === "/settings";

  if (access && isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!access && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/signup", "/dashboard", "/projects", "/events", "/settings"],
};
