import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ArchiveClient from "./ArchiveClient";

export default async function ArchivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-white">
      <ArchiveClient />
    </main>
  );
}
