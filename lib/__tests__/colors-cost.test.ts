import { describe, expect, it } from "vitest";
import { costOf } from "../ai-cost";
import { BAC_COLORS, nextColor } from "../bac-colors";

describe("couleurs des bacs", () => {
  it("prend la première couleur libre", () => {
    expect(nextColor([])).toBe(BAC_COLORS[0].bg);
    expect(nextColor([BAC_COLORS[0].bg])).toBe(BAC_COLORS[1].bg);
  });

  it("quand tout est pris, recycle la moins utilisée (pas deux fois la même d'affilée)", () => {
    const all = BAC_COLORS.map((c) => c.bg);
    const first = nextColor([...all, all[0], all[1]]);
    expect(first).toBe(all[2]);
    expect(nextColor([...all, all[0], all[1], first])).toBe(all[3]);
  });
});

describe("coût de l'IA", () => {
  it("compte entrée, sortie et cache au tarif du modèle", () => {
    // Sonnet 5.5 : 2 $ / 10 $ par million, lecture du cache 0,20 $, écriture 1,25 × entrée.
    expect(costOf("claude-sonnet-5-5", { input: 1_000_000, output: 0, cacheWrite: 0, cacheRead: 0 })).toBeCloseTo(2);
    expect(costOf("claude-sonnet-5-5", { input: 0, output: 1_000_000, cacheWrite: 0, cacheRead: 0 })).toBeCloseTo(10);
    expect(costOf("claude-sonnet-5-5", { input: 141, output: 255, cacheWrite: 10_497, cacheRead: 0 })).toBeCloseTo(0.02907, 4);
    expect(costOf("claude-fable-5-1", { input: 0, output: 0, cacheWrite: 0, cacheRead: 1_000_000 })).toBeCloseTo(0.25);
  });
});
