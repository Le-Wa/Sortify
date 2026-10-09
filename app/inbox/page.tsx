import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import InboxClient from "./inbox-list";

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const onboarding = await getUserWithOnboarding(session.userId);
  const onboardingDone = onboarding?.onboarding_status === "complete";

  return <InboxClient onboardingDone={onboardingDone} />;
}
