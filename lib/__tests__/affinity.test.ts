import { describe, expect, it } from "vitest";
import { affinity, bacSimilarity } from "../affinity";

const t = (id: string, artist: string, families: string[]) => ({ track_id: id, artist, families });

describe("affinité entre potes", () => {
  it("vaut 100 pour deux bibliothèques identiques", () => {
    const lib = [t("1", "Rema", ["afro"]), t("2", "Booba", ["rap"])];
    expect(affinity(lib, lib).score).toBe(100);
  });

  it("vaut 0 sans genre ni artiste commun", () => {
    expect(affinity([t("1", "Rema", ["afro"])], [t("2", "Aphex Twin", ["électro"])]).score).toBe(0);
  });

  it("trouve titres, artistes et famille de rencontre", () => {
    const a = [t("1", "Rema", ["afro"]), t("2", "Booba", ["rap"]), t("3", "Daft Punk", ["électro"])];
    const b = [t("1", "Rema", ["afro"]), t("4", "Rema", ["afro"]), t("5", "Kalash", ["latino-caraïbes"])];
    const r = affinity(a, b);
    expect(r.sharedTracks).toEqual(["1"]);
    expect(r.sharedArtists).toEqual(["Rema"]);
    expect(r.meetingFamily).toBe("afro");
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(100);
  });

  it("rapproche deux bacs qui partagent artistes et genres", () => {
    const soul = [t("1", "Masego", ["soul-rnb"]), t("2", "Jorja Smith", ["soul-rnb"])];
    const rnb = [t("3", "Jorja Smith", ["soul-rnb"]), t("4", "SZA", ["soul-rnb"])];
    const techno = [t("5", "Amelie Lens", ["électro"])];
    expect(bacSimilarity(soul, rnb)).toBeGreaterThan(bacSimilarity(soul, techno));
  });
});
