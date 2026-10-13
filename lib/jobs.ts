import "server-only";
import { check, db } from "./db";
import { env } from "./env";

export type JobKind = "import" | "analyse" | "creation" | "tri" | "reanalyse" | "bac" | "anciens";
export type JobStatus = "running" | "done" | "failed";

export interface Job<P = Record<string, unknown>> {
  id: string;
  member_id: string;
  kind: JobKind;
  status: JobStatus;
  progress: P;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  lease_until: string | null;
  updated_at: string;
}

/** Durée d'un passage de worker : sous la limite de 300 s des fonctions Vercel. */
export const STEP_BUDGET_MS = 240_000;
const LEASE_S = 300;
/** Sans battement de cœur depuis ce délai, un job « en cours » est considéré comme bloqué. */
const STALL_MS = 90_000;

const leaseUntil = () => new Date(Date.now() + LEASE_S * 1000).toISOString();

export async function getJob<P>(id: string): Promise<Job<P> | null> {
  const data = check(await db().from("jobs").select("*").eq("id", id).maybeSingle(), "Lecture du job");
  return (data as Job<P> | null) ?? null;
}

export async function latestJob<P>(memberId: string, kind: JobKind): Promise<Job<P> | null> {
  const data = check(
    await db()
      .from("jobs")
      .select("*")
      .eq("member_id", memberId)
      .eq("kind", kind)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "Lecture du dernier job",
  );
  return (data as Job<P> | null) ?? null;
}

/** Crée un job, ou renvoie celui qui tourne déjà pour ce membre et ce type. */
export async function startJob<P>(memberId: string, kind: JobKind, progress: P): Promise<Job<P>> {
  const { data, error } = await db()
    .from("jobs")
    .insert({ member_id: memberId, kind, progress })
    .select("*")
    .single();
  if (!error) return data as Job<P>;
  // 23505 : un job de ce type tourne déjà (index unique jobs_one_running).
  if (error.code !== "23505") throw new Error(`Création du job : ${error.message}`);
  const running = await latestJob<P>(memberId, kind);
  if (!running || running.status !== "running") throw new Error("Création du job : conflit sans job en cours");
  return running;
}

/** Prend le bail du job. Renvoie null si un autre worker le tient ou s'il est terminé. */
export async function claimJob<P>(id: string): Promise<Job<P> | null> {
  const now = new Date().toISOString();
  const data = check(
    await db()
      .from("jobs")
      .update({ lease_until: leaseUntil(), updated_at: now })
      .eq("id", id)
      .eq("status", "running")
      .or(`lease_until.is.null,lease_until.lt.${now}`)
      .select("*"),
    "Prise du job",
  );
  return ((data as Job<P>[])[0] as Job<P> | undefined) ?? null;
}

/** Sauvegarde la progression et prolonge le bail (battement de cœur). */
export async function saveProgress<P>(id: string, progress: P): Promise<void> {
  check(
    await db()
      .from("jobs")
      .update({ progress, lease_until: leaseUntil(), updated_at: new Date().toISOString() })
      .eq("id", id),
    "Sauvegarde de la progression",
  );
}

export async function releaseJob<P>(id: string, progress: P): Promise<void> {
  check(
    await db().from("jobs").update({ progress, lease_until: null, updated_at: new Date().toISOString() }).eq("id", id),
    "Libération du job",
  );
}

export async function finishJob<P>(id: string, progress: P): Promise<void> {
  const now = new Date().toISOString();
  check(
    await db()
      .from("jobs")
      .update({ progress, status: "done", lease_until: null, updated_at: now, finished_at: now })
      .eq("id", id),
    "Fin du job",
  );
}

export async function failJob(id: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  check(
    await db()
      .from("jobs")
      .update({ status: "failed", error: message.slice(0, 1000), lease_until: null, updated_at: now, finished_at: now })
      .eq("id", id),
    "Échec du job",
  );
}

export interface Incident {
  member: string;
  kind: JobKind;
  error: string;
  at: string;
}

/** Tâches de fond en échec ces derniers jours, tous membres confondus (Réglages du propriétaire). */
export async function recentIncidents(days = 7): Promise<Incident[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = check(
    await db()
      .from("jobs")
      .select("kind, error, finished_at, started_at, members(display_name, spotify_id)")
      .eq("status", "failed")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(30),
    "Lecture des incidents",
  ) as unknown as { kind: JobKind; error: string | null; finished_at: string | null; started_at: string; members: { display_name: string | null; spotify_id: string } | null }[];
  return rows.map((r) => ({
    member: r.members?.display_name ?? r.members?.spotify_id ?? "?",
    kind: r.kind,
    error: r.error ?? "erreur inconnue",
    at: r.finished_at ?? r.started_at,
  }));
}

export function isStalled(job: Job<unknown>): boolean {
  if (job.status !== "running") return false;
  const leaseOver = !job.lease_until || Date.parse(job.lease_until) < Date.now();
  return leaseOver && Date.now() - Date.parse(job.updated_at) > STALL_MS;
}

/** Demande au serveur de faire avancer le job (route /api/jobs/[id]/run). */
export async function kickJob(id: string): Promise<void> {
  const res = await fetch(`${env.appUrl}/api/jobs/${id}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.cronSecret}` },
  });
  if (!res.ok) throw new Error(`Relance du job ${id} : HTTP ${res.status}`);
}
