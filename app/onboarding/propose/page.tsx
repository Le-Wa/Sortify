import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import ProposeClient from "./ProposeClient";

export default async function ProposePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/onboarding");

  const user = await getUserWithOnboarding(session.userId);
  if (!user || !user.proposal_ready) redirect("/dashboard");

  return <ProposeClient />;
}
