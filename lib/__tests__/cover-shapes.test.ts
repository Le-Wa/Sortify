import { describe, expect, it } from "vitest";
import { FICHE_SHAPES, isShape, markFor, shapeParts, uniqueShape } from "../cover-shapes";

describe("formes des pochettes", () => {
  it("chaque forme a un dessin", () => {
    for (const s of [...FICHE_SHAPES, "asterisk" as const]) expect(shapeParts(s).length).toBeGreaterThan(0);
  });

  it("garde la forme voulue si elle est libre, sinon la première libre", () => {
    expect(uniqueShape("bolt", ["sun"])).toBe("bolt");
    expect(uniqueShape("bolt", ["bolt"])).toBe(FICHE_SHAPES.find((s) => s !== "bolt"));
    // L'astérisque est réservé à Divers.
    expect(uniqueShape("asterisk", [])).not.toBe("asterisk");
    expect(uniqueShape(null, [])).toBe(FICHE_SHAPES[0]);
  });

  it("pleine pour une scène, en contour sinon, sauf choix explicite", () => {
    expect(markFor({ name: "Rap", shape: "triangle", axis: "scène" })).toEqual({ shape: "triangle", outline: false });
    expect(markFor({ name: "Focus", shape: "waves", axis: "ambiance" }).outline).toBe(true);
    expect(markFor({ name: "Rap", shape: "triangle", axis: "scène", outline: true }).outline).toBe(true);
    expect(markFor({ name: "Divers", axis: "ambiance", is_divers: true })).toEqual({ shape: "asterisk", outline: false });
  });

  it("donne une forme stable aux anciens bacs sans forme", () => {
    const a = markFor({ name: "Soul nocturne", shape: null, axis: "scène" });
    expect(isShape(a.shape)).toBe(true);
    expect(markFor({ name: "Soul nocturne", shape: null, axis: "scène" }).shape).toBe(a.shape);
  });
});
