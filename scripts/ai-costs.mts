// Coût de l'IA par membre et par tâche (table ai_usage, depuis le 11/10/2026).
// Usage : npm run try -- scripts/ai-costs.mts [jours]   (30 jours par défaut)
import { db } from "@/lib/db";

const days = Number(process.argv[2] ?? 30);
const since = new Date(Date.now() - days * 86_400_000).toISOString();
const rows: { member_id: string | null; scope: string; step: string; model: string; cost_usd: number }[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db().from("ai_usage").select("member_id, scope, step, model, cost_usd").gte("created_at", since).range(from, from + 999);
  if (error) throw new Error(error.message);
  rows.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
}
const { data: members, error } = await db().from("members").select("spotify_id, display_name");
if (error) throw new Error(error.message);
const who = new Map((members ?? []).map((m) => [m.spotify_id, m.display_name ?? m.spotify_id]));

const sum = (list: typeof rows) => list.reduce((n, r) => n + Number(r.cost_usd), 0);
const money = (n: number) => `${n.toFixed(2)} $`;
console.log(`Coût de l'IA sur ${days} jours : ${money(sum(rows))} (${rows.length} appels)\n`);
const byMember = Map.groupBy(rows, (r) => r.member_id ?? "hors app");
for (const [member, list] of byMember) {
  console.log(`${who.get(member) ?? member} : ${money(sum(list))}`);
  for (const [scope, part] of Map.groupBy(list, (r) => r.scope)) {
    const steps = [...Map.groupBy(part, (r) => `${r.step} (${r.model.replace("claude-", "")})`)].map(([s, l]) => `${s} ${money(sum(l))}`);
    console.log(`   ${scope} : ${money(sum(part))} — ${steps.join(" · ")}`);
  }
}
