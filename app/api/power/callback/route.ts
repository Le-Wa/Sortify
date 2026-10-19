import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { countMembers, createMember, getMember, saveTokens } from "@/lib/members";
import { db } from "@/lib/db";
import { exchangeCode, POWER_COOKIE, signHandoff } from "@/lib/power-login";
import { decrypt, encrypt } from "@/lib/secrets";

interface Pending {
  clientId: string;
  clientSecret: string;
  /** Clé Anthropic déjà vérifiée sur /power : obligatoire, le power user entre sans invitation et paie son IA. */
  anthropicKey: string;
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
  if (!pending.anthropicKey) return back("cle");

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
      // Sans invitation : sa propre app Spotify (hors des 5 places) et sa propre clé Anthropic, il ne coûte rien à Sortify.
      const first = (await countMembers()) === 0;
      await createMember({ spotifyId: me.id, displayName: me.display_name ?? null, email: me.email ?? null, tokens, isOwner: first });
    }
    const { error } = await db()
      .from("members")
      .update({
        spotify_client_id: app.clientId,
        spotify_client_secret_enc: encrypt(app.clientSecret),
        // Enregistrée avant la première visite de /revelation : l'analyse, la plus chère, passe déjà par cette clé.
        anthropic_key_enc: encrypt(pending.anthropicKey),
      })
      .eq("spotify_id", me.id);
    if (error) throw new Error(error.message);
    return NextResponse.redirect(new URL(`/power/connexion?t=${encodeURIComponent(signHandoff(me.id))}`, req.url));
  } catch (error) {
    console.error("Connexion power user :", error);
    return back("spotify");
  }
}
