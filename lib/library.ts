import "server-only";
import { db } from "./db";

async function count(table: string, filters: Record<string, string | boolean>, context: string): Promise<number> {
  let query = db().from(table).select("*", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count: n, error } = await query;
  if (error) throw new Error(`${context} : ${error.message}`);
  return n ?? 0;
}

/** Le membre a-t-il déjà validé ses bacs ? Sinon il est encore dans la Révélation. */
export async function hasActiveBacs(memberId: string): Promise<boolean> {
  return (await count("bacs", { member_id: memberId, status: "active", is_divers: false }, "Lecture des bacs")) > 0;
}

export async function countPending(memberId: string): Promise<number> {
  return count("pending", { member_id: memberId }, "Lecture de « À trier »");
}

/** Page d'arrivée d'un membre connecté. */
export async function homeFor(memberId: string): Promise<"/accueil" | "/revelation"> {
  return (await hasActiveBacs(memberId)) ? "/accueil" : "/revelation";
}
