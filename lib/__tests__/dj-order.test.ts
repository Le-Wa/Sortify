import { describe, expect, it } from "vitest";
import { camelot, djOrder, keyDistance, tempoGap } from "../dj-order";

describe("ordre DJ", () => {
  it("place les tonalités sur la roue de Camelot", () => {
    expect(camelot(0, 1)).toBe("8B"); // do majeur
    expect(camelot(9, 0)).toBe("8A"); // la mineur
    expect(camelot(7, 1)).toBe("9B"); // sol majeur
    expect(camelot(null, 1)).toBeNull();
  });

  it("reconnaît les tonalités compatibles", () => {
    expect(keyDistance("8B", "8B")).toBe(0);
    expect(keyDistance("8B", "9B")).toBe(0);
    expect(keyDistance("12A", "1A")).toBe(0); // la roue boucle
    expect(keyDistance("8B", "8A")).toBe(0); // relatif
    expect(keyDistance("8B", "10B")).toBe(1);
    expect(keyDistance("8B", "2A")).toBe(2);
  });

  it("compte le demi et le double tempo comme proches", () => {
    expect(tempoGap(70, 140)).toBe(0);
    expect(tempoGap(120, 126)).toBeCloseTo(0.05);
  });

  it("monte en énergie et met les titres sans données à la fin", () => {
    const order = djOrder([
      { id: "fort", tempo: 128, key: 0, mode: 1, energy: 0.9 },
      { id: "doux", tempo: 120, key: 0, mode: 1, energy: 0.3 },
      { id: "vide" },
      { id: "moyen", tempo: 124, key: 7, mode: 1, energy: 0.6 },
    ]);
    expect(order).toEqual(["doux", "moyen", "fort", "vide"]);
  });

  it("garde tous les titres, une seule fois", () => {
    const tracks = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, tempo: 90 + (i * 7) % 50, key: i % 12, mode: i % 2, energy: (i * 37) % 100 / 100 }));
    const order = djOrder(tracks);
    expect(order).toHaveLength(60);
    expect(new Set(order).size).toBe(60);
  });
});
