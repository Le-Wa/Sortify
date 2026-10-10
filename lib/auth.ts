import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession, type NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { env } from "./env";
import {
  consumeInvitation,
  countMembers,
  createMember,
  deleteMember,
  getMember,
  MAX_MEMBERS,
  saveTokens,
  type Member,
} from "./members";

export const INVITE_COOKIE = "sortify_invite";

const SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "ugc-image-upload",
  "user-read-email",
].join(" ");

export const authOptions: NextAuthOptions = {
  secret: env.nextAuthSecret,
  session: { strategy: "jwt", maxAge: 60 * 24 * 60 * 60 },
  pages: { signIn: "/", error: "/" },
  providers: [
    SpotifyProvider({
      clientId: env.spotifyClientId,
      clientSecret: env.spotifyClientSecret,
      authorization: { params: { scope: SCOPES } },
    }),
  ],
  callbacks: {
    // Un compte Spotify n'entre que s'il est déjà membre, s'il est le tout premier
    // (il devient le propriétaire) ou s'il apporte un code d'invitation valide.
    async signIn({ account, profile }) {
      if (!account || account.provider !== "spotify" || !account.access_token || !account.refresh_token) return false;
      const spotifyId = account.providerAccountId;
      const tokens = {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      };

      if (await getMember(spotifyId)) {
        await saveTokens(spotifyId, tokens);
        return true;
      }

      const memberCount = await countMembers();
      const base = {
        spotifyId,
        displayName: (profile as { display_name?: string } | undefined)?.display_name ?? profile?.name ?? null,
        email: profile?.email ?? null,
        tokens,
      };
      if (memberCount === 0) {
        await createMember({ ...base, isOwner: true });
        return true;
      }
      if (memberCount >= MAX_MEMBERS) return "/?erreur=complet";

      const jar = await cookies();
      const code = jar.get(INVITE_COOKIE)?.value;
      if (!code) return "/?erreur=invitation";
      // Le membre doit exister avant de pouvoir être référencé par l'invitation.
      await createMember({ ...base, isOwner: false });
      if (!(await consumeInvitation(code, spotifyId))) {
        await deleteMember(spotifyId);
        jar.delete(INVITE_COOKIE);
        return "/?erreur=code";
      }
      jar.delete(INVITE_COOKIE);
      return true;
    },
    async jwt({ token, account }) {
      if (account) token.spotifyId = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      session.spotifyId = token.spotifyId ?? "";
      return session;
    },
  },
};

/** Membre connecté, ou null. */
export async function currentMember(): Promise<Member | null> {
  const session = await getServerSession(authOptions);
  if (!session?.spotifyId) return null;
  return getMember(session.spotifyId);
}

/** Membre connecté ; sinon renvoie vers la page de connexion. */
export async function requireMember(): Promise<Member> {
  const member = await currentMember();
  if (!member) redirect("/");
  return member;
}
