import { notFound } from "next/navigation";
import { Board } from "./Board";

/** Planche des idées du 13/10/2026 : Divers, import des playlists, petits gains, plus tard (développement seulement). */
export default function IdeesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Board />;
}
