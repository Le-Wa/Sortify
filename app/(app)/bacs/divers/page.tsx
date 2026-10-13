import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { listBacs } from "@/lib/bacs";
import { chip } from "@/lib/daily";
import { diversCatalog, FAMILY_LABELS } from "@/lib/divers";
import { openSuggestions } from "@/lib/suggestions";
import { SuggestionCards } from "../../accueil/SuggestionCards";
import { DiversList } from "./DiversList";
import { MakeBacs } from "./MakeBacs";

/** Au-delà, proposer à l'IA d'y chercher des bacs. */
const MANY = 30;

export default async function DiversPage() {
  const member = await requireMember();
  const [items, bacs, suggestions] = await Promise.all([
    diversCatalog(member.spotify_id),
    listBacs(member.spotify_id, ["active"]),
    openSuggestions(member.spotify_id),
  ]);
  const fromDivers = suggestions.filter((s) => s.origin === "divers");
  return (
    <>
      <Link href="/bacs" className="back">
        ‹ Bacs
      </Link>
      <div className="crate-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <span className="label">Fragile · à trier un jour</span>
        <h1 className="crate-card__label" style={{ fontSize: 50, margin: 0 }}>
          Caisse
          <br />
          Divers
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>
          <b>{items.length} titres</b> attendent leur bac. Filtre par genre, range un artiste d&apos;un coup, ou passe-les un par un.
        </p>
      </div>
      {fromDivers.length > 0 ? <SuggestionCards suggestions={fromDivers} /> : items.length >= MANY ? <MakeBacs /> : null}
      <DiversList items={items} bacs={bacs.map((b) => ({ ...chip(b), is_divers: false }))} labels={FAMILY_LABELS} />
    </>
  );
}
