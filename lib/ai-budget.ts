import "server-only";
import { check, db } from "./db";

/**
 * Alerte de coût : un membre qui coûte plus que ça en 7 jours sur le compte de Sortify mérite un coup d'œil
 * (une première analyse coûte ~5 à 9 $, un mois de tri ~0,50 $). Les membres avec leur propre clé ne comptent pas.
 */
export const COST_ALERT_USD = 10;

export interface MemberCost {
  memberId: string;
  name: string;
  /** Payé par Sortify (hors clé personnelle). */
  cost: number;
  /** Payé par le membre avec sa propre clé. */
  ownKey: number;
}

/** Coût de l'IA par membre sur les `days` derniers jours, du plus cher au moins cher. */
export async function costByMember(days: number): Promise<MemberCost[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows: { member_id: string | null; cost_usd: number; own_key: boolean }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(
      await db().from("ai_usage").select("member_id, cost_usd, own_key").gte("created_at", since).range(from, from + 999),
      "Lecture du coût de l'IA",
    ) as typeof rows;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const members = check(await db().from("members").select("spotify_id, display_name"), "Lecture des membres") as {
    spotify_id: string;
    display_name: string | null;
  }[];
  const names = new Map(members.map((m) => [m.spotify_id, m.display_name ?? m.spotify_id]));
  const byMember = new Map<string, MemberCost>();
  for (const r of rows) {
    if (!r.member_id) continue;
    const entry = byMember.get(r.member_id) ?? { memberId: r.member_id, name: names.get(r.member_id) ?? r.member_id, cost: 0, ownKey: 0 };
    if (r.own_key) entry.ownKey += Number(r.cost_usd);
    else entry.cost += Number(r.cost_usd);
    byMember.set(r.member_id, entry);
  }
  return [...byMember.values()].sort((a, b) => b.cost - a.cost);
}

/** Membres au-dessus du seuil d'alerte sur les 7 derniers jours (bandeau du propriétaire). */
export async function costAlerts(): Promise<MemberCost[]> {
  return (await costByMember(7)).filter((m) => m.cost > COST_ALERT_USD);
}

export const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;
