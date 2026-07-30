import { NextRequest, NextResponse } from "next/server";

const accessCookie = "wobuy174_access_token";
const refreshCookie = "wobuy174_refresh_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(accessCookie) || request.cookies.has(refreshCookie);

  if (pathname === "/login") return NextResponse.next();

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
