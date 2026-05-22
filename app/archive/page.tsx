import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ArchiveClient from "./ArchiveClient";

export default async function ArchivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  return <ArchiveClient />;
}
