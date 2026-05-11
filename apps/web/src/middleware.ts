import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_PREFIXES = ["/cn-to-vi", "/editor", "/projects", "/api"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    return;
  }
  return NextResponse.redirect(new URL("/cn-to-vi", request.url));
}

export const config = {
  matcher: ["/((?!_next/|favicon|.*\\..*).*)"],
};
