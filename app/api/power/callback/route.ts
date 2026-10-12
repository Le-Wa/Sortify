import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { consumeInvitation, countMembers, createMember, deleteMember, getMember, saveTokens } from "@/lib/members";
import { db } from "@/lib/db";
import { exchangeCode, POWER_COOKIE, signHandoff } from "@/lib/power-login";
import { decrypt, encrypt } from "@/lib/secrets";

interface Pending {
  clientId: string;
  clientSecret: string;
  invite: string | null;
  state: string;
  exp: number;
}

/** Retour de Spotify pour un power user : crée ou met à jour le membre, puis passe la main à la session NextAuth. */
export async function GET(req: NextRequest) {
  const back = (erreur: string) => NextResponse.redirect(new URL(`/power?erreur=${erreur}`, req.url));
  const jar = await cookies();
  const raw = jar.get(POWER_COOKIE)?.value;
  jar.delete(POWER_COOKIE);
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back("refus");
  let pending: Pending;
  try {
    if (!raw) return back("expire");
    pending = JSON.parse(decrypt(raw)) as Pending;
  } catch {
    return back("expire");
  }
  if (pending.exp < Date.now() || params.get("state") !== pending.state || !params.get("code")) return back("expire");

  const app = { clientId: pending.clientId, clientSecret: pending.clientSecret };
  try {
    const tokens = await exchangeCode(app, params.get("code")!);
    const me = (await (await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json()) as {
      id?: string;
      display_name?: string | null;
      email?: string | null;
    };
    if (!me.id) return back("spotify");

    if (await getMember(me.id)) {
      await saveTokens(me.id, tokens);
    } else {
      const first = (await countMembers()) === 0;
      if (!first && !pending.invite) return back("invitation");
      await createMember({ spotifyId: me.id, displayName: me.display_name ?? null, email: me.email ?? null, tokens, isOwner: first });
      if (!first && !(await consumeInvitation(pending.invite!, me.id))) {
        await deleteMember(me.id);
        return back("code");
      }
    }
    const { error } = await db()
      .from("members")
      .update({ spotify_client_id: app.clientId, spotify_client_secret_enc: encrypt(app.clientSecret) })
      .eq("spotify_id", me.id);
    if (error) throw new Error(error.message);
    return NextResponse.redirect(new URL(`/power/connexion?t=${encodeURIComponent(signHandoff(me.id))}`, req.url));
  } catch (error) {
    console.error("Connexion power user :", error);
    return back("spotify");
  }
}
