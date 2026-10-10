import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { countPending, hasActiveBacs } from "@/lib/library";
import { TabBar } from "../ui/TabBar";

/** Pages du quotidien : réservées aux membres qui ont déjà leurs bacs. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  if (!(await hasActiveBacs(member.spotify_id))) redirect("/revelation");
  const pending = await countPending(member.spotify_id);

  return (
    <>
      <main className="page">{children}</main>
      <TabBar pending={pending} />
    </>
  );
}
