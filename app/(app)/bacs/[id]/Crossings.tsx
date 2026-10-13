import Link from "next/link";
import { crossingsFor } from "@/lib/potes";
import { Sleeve } from "../../../ui/Sleeve";
import { RecoList } from "../../potes/RecoList";

/** B. Croisement : chez chaque pote qui partage, le bac le plus proche de celui-ci et ses titres que tu n'as pas. */
export async function Crossings({ memberId, bacId }: { memberId: string; bacId: string }) {
  let crossings;
  try {
    crossings = await crossingsFor(memberId, bacId);
  } catch (error) {
    // Un bonus de la page : s'il échoue, la fiche du bac reste utilisable.
    console.error("Croisement avec les potes :", error instanceof Error ? error.message : error);
    return null;
  }
  if (crossings.length === 0) return null;
  return (
    <>
      <div className="label section-label">Chez tes potes</div>
      {crossings.map((c) => (
        <section key={c.bac.id} className="card stack" style={{ gap: 10, padding: 14 }}>
          <Link href={`/potes/bac/${c.bac.id}`} className="row" style={{ gap: 10, color: "inherit", textDecoration: "none" }}>
            <Sleeve name={c.bac.sleeve} color={c.bac.color} size={56} mark={c.bac.mark} />
            <span className="grow">
              <b>
                Chez {c.pote} : « {c.bac.name} »
              </b>
              <br />
              <span className="small muted">
                proche de ton bac{c.common > 0 ? ` · ${c.common} titre${c.common > 1 ? "s" : ""} en commun` : ""}
              </span>
            </span>
            <span aria-hidden="true" className="muted">
              ›
            </span>
          </Link>
          <span className="label">Ce que tu n&apos;as pas encore</span>
          <RecoList tracks={c.suggestions} />
        </section>
      ))}
    </>
  );
}
