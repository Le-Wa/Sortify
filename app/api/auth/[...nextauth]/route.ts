import "@/lib/types";
import NextAuth, { type NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { createClient } from "@/lib/supabase/client";

const SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
].join(" ");

export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: { params: { scope: SCOPES } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign-in: persist tokens and sync to DB
      if (account) {
        const expiresAt = account.expires_at ?? Math.floor(Date.now() / 1000) + 3600;

        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = expiresAt;
        // providerAccountId is always the Spotify user ID
        token.spotifyId = account.providerAccountId;

        const supabase = createClient();
        await supabase.from("users").upsert(
          {
            spotify_id: account.providerAccountId,
            email: profile?.email,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: expiresAt,
          },
          { onConflict: "spotify_id" }
        );

        return token;
      }

      // Token still valid — nothing to do
      if (Date.now() < (token.expiresAt ?? 0) * 1000 - 5 * 60 * 1000) {
        return token;
      }

      // Access token expired — refresh it
      try {
        const res = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: token.refreshToken ?? "",
          }),
        });

        const refreshed = await res.json();
        if (!res.ok) throw refreshed;

        const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
        const newRefreshToken: string = refreshed.refresh_token ?? token.refreshToken;

        token.accessToken = refreshed.access_token;
        token.refreshToken = newRefreshToken;
        token.expiresAt = newExpiresAt;
        delete token.error;

        const supabase = createClient();
        await supabase
          .from("users")
          .update({
            access_token: refreshed.access_token,
            refresh_token: newRefreshToken,
            expires_at: newExpiresAt,
          })
          .eq("spotify_id", token.spotifyId);

        return token;
      } catch {
        return { ...token, error: "RefreshAccessTokenError" };
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken ?? "";
      session.userId = token.spotifyId ?? "";
      if (token.error) session.error = token.error;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
