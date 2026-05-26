import "@/lib/types";
import NextAuth, { type NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { createClient } from "@/lib/supabase/client";
import { refreshSpotifyToken } from "@/lib/spotify/token";

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
        const refreshed = await refreshSpotifyToken(token.refreshToken ?? "");

        token.accessToken = refreshed.access_token;
        token.refreshToken = refreshed.refresh_token;
        token.expiresAt = refreshed.expires_at;
        delete token.error;

        const supabase = createClient();
        await supabase
          .from("users")
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_at,
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
