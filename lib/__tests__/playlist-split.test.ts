import { describe, expect, it } from "vitest";
import { splitByFamily } from "../playlist-split";

const tracks = (n: number, families: string[], from = 0) => Array.from({ length: n }, (_, i) => ({ track_id: `t${from + i}`, families }));

describe("découpage d'une playlist trop large", () => {
  it("garde entière une playlist cohérente", () => {
    const r = splitByFamily([...tracks(40, ["rap"]), ...tracks(10, ["soul-rnb"], 40)]);
    expect(r.broad).toBe(false);
  });

  it("découpe une playlist sans genre majoritaire", () => {
    const r = splitByFamily([...tracks(30, ["rap"]), ...tracks(25, ["afro"], 30), ...tracks(20, ["électro"], 55), ...tracks(5, ["jazz"], 75)]);
    expect(r.broad).toBe(true);
    expect(r.parts.map((p) => p.label)).toEqual(["Rap", "Afro", "Électro"]);
    expect(r.parts[0].ids).toHaveLength(30);
  });

  it("range un titre à plusieurs genres dans le plus présent de la playlist", () => {
    const r = splitByFamily([...tracks(20, ["rap"]), ...tracks(20, ["afro"], 20), { track_id: "x", families: ["afro", "pop-rock"] }]);
    expect(r.parts.find((p) => p.family === "afro")?.ids).toContain("x");
  });

  it("ne découpe pas une petite playlist", () => {
    expect(splitByFamily([...tracks(12, ["rap"]), ...tracks(12, ["afro"], 12)]).broad).toBe(false);
  });
});
