import { describe, expect, it } from "vitest";
import { librarySize, maxBacs, MIN_LIBRARY, minPerBac, SMALL_LIBRARY } from "../library-size";

describe("taille de la bibliothèque", () => {
  it("classe selon les seuils", () => {
    expect(librarySize(0)).toBe("trop-petite");
    expect(librarySize(MIN_LIBRARY - 1)).toBe("trop-petite");
    expect(librarySize(MIN_LIBRARY)).toBe("petite");
    expect(librarySize(SMALL_LIBRARY - 1)).toBe("petite");
    expect(librarySize(SMALL_LIBRARY)).toBe("normale");
  });

  it("limite le nombre de bacs d'une petite bibliothèque", () => {
    expect(maxBacs(40)).toBe(3);
    expect(maxBacs(1200)).toBeNull();
  });

  it("garde des bacs remplissables", () => {
    expect(minPerBac(20)).toBe(8);
    expect(minPerBac(59)).toBe(9);
    // 3 bacs au minimum rempli tiennent dans une petite bibliothèque.
    expect(3 * minPerBac(40)).toBeLessThanOrEqual(40);
    expect(minPerBac(300)).toBe(15);
    expect(minPerBac(2340)).toBe(70);
  });
});
