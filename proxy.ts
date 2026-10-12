import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.spotifyId) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/accueil/:path*", "/a-trier/:path*", "/bacs/:path*", "/arrivages/:path*", "/reglages/:path*", "/revelation/:path*"],
};
