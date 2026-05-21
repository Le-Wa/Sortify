import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AdminClient from "./AdminClient";

export default async function AdminLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-white">
      <AdminClient />
    </main>
  );
}
