import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Navbar from "@/app/ui/Navbar";
import PlaylistDetailClient from "./PlaylistDetailClient";

type Params = Promise<{ id: string }>;

export default async function PlaylistDetailPage({ params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const { id } = await params;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 text-white">
        <PlaylistDetailClient playlistId={id} />
      </main>
    </>
  );
}
