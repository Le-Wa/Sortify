import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { countPending, hasActiveBacs } from "@/lib/library";
import { TabBar } from "../ui/TabBar";

/** Pages du quotidien : réservées aux membres qui ont déjà leurs bacs. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const [active, pending] = await Promise.all([hasActiveBacs(member.spotify_id), countPending(member.spotify_id)]);
  if (!active) redirect("/revelation");

  return (
    <>
      <main className="page">{children}</main>
      <TabBar pending={pending} />
    </>
  );
}
