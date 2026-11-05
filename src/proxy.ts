import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/shared/auth/auth";

const PROTECTED_PREFIXES = ["/dashboard"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const protectedRoute = isProtected(request.nextUrl.pathname);

  if (!getSessionCookie(request)) {
    return protectedRoute ? redirectToLogin(request) : NextResponse.next();
  }

  try {
    const { headers, response: session } = await auth.api.getSession({
      headers: request.headers,
      returnHeaders: true,
    });

    const response =
      session || !protectedRoute ? NextResponse.next() : redirectToLogin(request);

    for (const cookie of headers.getSetCookie()) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("[proxy] session check failed:", error);
    return NextResponse.next();
  }
}

function redirectToLogin(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
