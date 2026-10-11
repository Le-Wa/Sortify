import { requireMember } from "@/lib/auth";
import { activeBacs, chip, pendingQueue } from "@/lib/daily";
import { TriageScreen } from "./TriageScreen";

export default async function ATrierPage() {
  const member = await requireMember();
  const [queue, bacs] = await Promise.all([pendingQueue(member.spotify_id), activeBacs(member.spotify_id)]);
  return (
    <TriageScreen
      queue={queue}
      bacs={bacs
        .filter((b) => !b.is_divers)
        .map((b) => ({ ...chip(b), is_divers: false }))}
    />
  );
}
