import { describe, expect, it } from "vitest";
import { nextCron, relativeDay } from "../dates";
import { weekKey, weekLabel } from "../weeks";

describe("tri du lundi", () => {
  it("vise le prochain lundi à 6 h UTC", () => {
    expect(nextCron(new Date("2026-10-11T12:00:00Z")).toISOString()).toBe("2026-10-12T06:00:00.000Z"); // dimanche
    expect(nextCron(new Date("2026-10-12T05:59:00Z")).toISOString()).toBe("2026-10-12T06:00:00.000Z"); // lundi avant le tri
    expect(nextCron(new Date("2026-10-12T06:00:00Z")).toISOString()).toBe("2026-10-19T06:00:00.000Z"); // lundi, tri passé
    expect(nextCron(new Date("2026-10-15T20:00:00Z")).toISOString()).toBe("2026-10-19T06:00:00.000Z"); // jeudi
  });

  it("dit les jours comme on les dit", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    expect(relativeDay(new Date("2026-10-12T15:00:00Z"), now)).toBe("aujourd'hui");
    expect(relativeDay(new Date("2026-10-11T15:00:00Z"), now)).toBe("hier");
    expect(relativeDay(new Date("2026-10-13T15:00:00Z"), now)).toBe("demain");
    expect(relativeDay(new Date("2026-10-15T15:00:00Z"), now)).toBe("jeudi");
    expect(relativeDay(new Date("2026-10-19T06:00:00Z"), now)).toBe("le 19 oct.");
  });
});

describe("semaines des Arrivages (heure de Paris)", () => {
  it("commence le lundi à minuit à Paris", () => {
    expect(weekKey(new Date("2026-10-11T21:30:00Z"))).toBe("2026-10-05"); // dimanche 23 h 30 à Paris
    expect(weekKey(new Date("2026-10-11T22:30:00Z"))).toBe("2026-10-12"); // lundi 0 h 30 à Paris
    expect(weekKey(new Date("2026-10-14T12:00:00Z"))).toBe("2026-10-12");
  });

  it("nomme la semaine par son lundi", () => {
    expect(weekLabel("2026-10-05")).toBe("Semaine du 5 oct.");
  });
});
