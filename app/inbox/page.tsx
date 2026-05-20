import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import InboxClient from "./inbox-list";

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  return <InboxClient />;
}
