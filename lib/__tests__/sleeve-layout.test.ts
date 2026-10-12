import { describe, expect, it } from "vitest";
import { lineWidthEm, shapeBox, sleeveLayout, splitLines } from "../sleeve-layout";

describe("mise en page des pochettes", () => {
  it("coupe un long mot unique en deux, avec un trait d'union", () => {
    expect(splitLines("Afrobeats")).toEqual(["Afro-", "beats"]);
    expect(splitLines("Jazz")).toEqual(["Jazz"]);
  });

  it("met un mot par ligne jusqu'à trois mots, trois lignes au plus au-delà", () => {
    expect(splitLines("Fin de nuit")).toEqual(["Fin", "de", "nuit"]);
    expect(splitLines("Rap français de plume et de rue").length).toBeLessThanOrEqual(3);
  });

  it("le nom tient dans la pochette", () => {
    for (const name of ["Tech house", "Soul nocturne", "Afrobeats", "Fin de nuit", "Rave warehouse"]) {
      const { lines, fontSize, padding } = sleeveLayout(name, 640);
      const widest = Math.max(...lines.map(lineWidthEm)) * fontSize;
      expect(widest).toBeLessThanOrEqual(640 - 2 * padding + 0.5);
    }
  });

  it("la forme ne touche pas le nom", () => {
    for (const name of ["Tech house", "Fin de nuit", "Focus", "Avant de sortir"]) {
      const size = 640;
      const { lines, fontSize, padding } = sleeveLayout(name, size);
      const { box, left, top } = shapeBox(name, size);
      const textTop = size - padding - lines.length * 0.94 * fontSize;
      lines.forEach((line, i) => {
        const lineTop = textTop + i * 0.94 * fontSize + fontSize * 0.08;
        const lineRight = padding + lineWidthEm(line) * fontSize;
        const overlaps = top + box > lineTop && left < lineRight;
        expect(overlaps, `${name} / ${line}`).toBe(false);
      });
    }
  });
});
