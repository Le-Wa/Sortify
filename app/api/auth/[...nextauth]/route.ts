import "@/lib/types";
import NextAuth, { type NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@/lib/supabase/client";
import { refreshSpotifyToken } from "@/lib/spotify/token";
import { verifyHandoffToken } from "@/lib/byok-session";

const SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
].join(" ");

export const authOptions: NextAuthOptions = {
  session: { maxAge: 30 * 24 * 60 * 60 }, // 30 jours
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: { params: { scope: SCOPES, show_dialog: true } },
    }),
    CredentialsProvider({
      id: "byok-handoff",
      name: "BYOK Handoff",
      credentials: { token: { type: "text" } },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        try {
          const payload = verifyHandoffToken(credentials.token);
          return { id: payload.spotifyId, name: payload.displayName };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user, profile }) {
      // BYOK handoff: CredentialsProvider sets user.id = spotifyId
      if (account?.type === "credentials" && user) {
        token.spotifyId = user.id;
        // Access token will be loaded from DB on first API call
        return token;
      }

      // Initial Spotify OAuth sign-in
      if (account) {
        const expiresAt = account.expires_at ?? Math.floor(Date.now() / 1000) + 3600;

        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = expiresAt;
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

      // Access token expired — refresh it (uses per-user credentials if available)
      try {
        const supabase = createClient();
        const { data: dbUser } = await supabase
          .from("users")
          .select("refresh_token, spotify_client_id, spotify_client_secret_enc")
          .eq("spotify_id", token.spotifyId)
          .single();

        let clientId: string | undefined;
        let clientSecret: string | undefined;
        if (dbUser?.spotify_client_id && dbUser.spotify_client_secret_enc) {
          const { decryptAES256GCM } = await import("@/lib/crypto");
          clientId = dbUser.spotify_client_id;
          clientSecret = decryptAES256GCM(dbUser.spotify_client_secret_enc);
        }

        const refreshToken = dbUser?.refresh_token ?? token.refreshToken ?? "";
        const refreshed = await refreshSpotifyToken(refreshToken, clientId, clientSecret);

        token.accessToken = refreshed.access_token;
        token.refreshToken = refreshed.refresh_token;
        token.expiresAt = refreshed.expires_at;
        delete token.error;

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
      // For BYOK users whose token was just set, load access token from DB
      if (!token.accessToken && token.spotifyId) {
        const supabase = createClient();
        const { data } = await supabase
          .from("users")
          .select("access_token, expires_at")
          .eq("spotify_id", token.spotifyId)
          .single();
        if (data) {
          session.accessToken = data.access_token ?? "";
        }
      } else {
        session.accessToken = token.accessToken ?? "";
      }
      session.userId = token.spotifyId ?? "";
      if (token.error) session.error = token.error;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
