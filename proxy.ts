import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/inbox", "/onboarding", "/archive"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!PROTECTED.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/inbox/:path*", "/onboarding/:path*", "/archive/:path*"],
};
