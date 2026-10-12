import { describe, expect, it } from "vitest";
import { contradicts, families, hasStyle } from "../enrichment/families";

describe("familles de genres", () => {
  it("range les tags dans leurs familles", () => {
    expect([...families(["hip-hop", "suomirap"])]).toEqual(["rap"]);
    expect(families(["deezer:techno/house"]).has("électro")).toBe(true);
    // « baile funk » est latino, pas soul-funk.
    expect(families(["baile funk"]).has("soul-rnb")).toBe(false);
    expect(families(["baile funk"]).has("latino-caraïbes")).toBe(true);
  });

  it("repère les homonymes Last.fm contredits par Deezer", () => {
    // HUGEL : Last.fm le prend pour un rappeur finlandais, Deezer dit électro.
    expect(contradicts(["hip-hop", "finnish", "suomirap"], ["deezer:electro", "deezer:techno/house"])).toBe(true);
    expect(contradicts(["rap", "french rap"], ["deezer:rap/hip hop"])).toBe(false);
  });

  it("ne tranche pas sans information", () => {
    expect(contradicts([], ["deezer:electro"])).toBe(false);
    expect(contradicts(["french", "female vocalists"], ["deezer:pop"])).toBe(false);
    // « pop » seul chez Deezer est trop vague.
    expect(contradicts(["rap"], ["deezer:pop"])).toBe(false);
  });

  it("sait si des tags disent un style", () => {
    expect(hasStyle(["french", "female vocalists"])).toBe(false);
    expect(hasStyle(["french", "rnb"])).toBe(true);
  });
});
