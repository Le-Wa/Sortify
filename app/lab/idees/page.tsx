import { notFound } from "next/navigation";
import { Board } from "./Board";

/** Planche des idées du 13/10/2026 : Divers, import des playlists, petits gains, plus tard (développement seulement). */
export default async function IdeesPage(props: PageProps<"/lab/idees">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { s } = await props.searchParams;
  return <Board only={typeof s === "string" ? s : null} />;
}
