"use server";

import { cookies } from "next/headers";
import { INVITE_COOKIE } from "@/lib/auth";
import { isInvitationUsable, normalizeCode } from "@/lib/members";

export type InvitationState = { status: "idle" } | { status: "ok" } | { status: "error"; message: string; code: string };

/** Vérifie le code puis le garde en cookie le temps de la connexion Spotify. */
export async function checkInvitation(_prev: InvitationState, formData: FormData): Promise<InvitationState> {
  const raw = formData.get("code");
  const code = typeof raw === "string" ? normalizeCode(raw) : "";
  if (!/^DISQ-([A-Z0-9]{4}|[A-Z0-9]{6})$/.test(code)) {
    return { status: "error", message: "Un code ressemble à DISQ-7K2P4M.", code };
  }
  if (!(await isInvitationUsable(code))) {
    return { status: "error", message: "Ce code n'existe pas ou a déjà servi.", code };
  }
  const jar = await cookies();
  jar.set(INVITE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
  return { status: "ok" };
}
