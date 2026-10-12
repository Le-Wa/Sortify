import "server-only";
import webpush from "web-push";
import { check, db } from "./db";
import { env } from "./env";

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

let configured = false;
function setup() {
  if (configured) return;
  // Le « sujet » VAPID est l'adresse de l'app : aucune donnée personnelle n'est envoyée aux services de notification.
  webpush.setVapidDetails(env.appUrl, env.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
}

export async function savePushSubscription(memberId: string, sub: PushSubscriptionJSON): Promise<void> {
  check(
    await db().from("push_subscriptions").upsert({ endpoint: sub.endpoint, member_id: memberId, keys: sub.keys }, { onConflict: "endpoint" }),
    "Abonnement aux notifications",
  );
}

export async function removePushSubscription(memberId: string, endpoint: string): Promise<void> {
  check(await db().from("push_subscriptions").delete().eq("member_id", memberId).eq("endpoint", endpoint), "Désabonnement");
}

/** Envoie une notification à tous les appareils du membre ; les abonnements expirés sont effacés. Renvoie le nombre d'envois réussis. */
export async function notify(memberId: string, message: { title: string; body: string; url: string }): Promise<number> {
  setup();
  const subs = check(await db().from("push_subscriptions").select("endpoint, keys").eq("member_id", memberId), "Lecture des abonnements") as PushSubscriptionJSON[];
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(message), { TTL: 6 * 3600 });
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await removePushSubscription(memberId, sub.endpoint);
      else console.warn("Notification non envoyée :", error instanceof Error ? error.message : error);
    }
  }
  return sent;
}
