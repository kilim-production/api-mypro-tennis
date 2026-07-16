import { describe, expect, it } from "vitest";
import {
  careerMilestoneStates,
  skillProgressPercent,
  skillUpgradeState
} from "./skillsUtils";

describe("skills utilities", () => {
  it("clamps XP progress safely", () => {
    expect(skillProgressPercent(50, 100)).toBe(50);
    expect(skillProgressPercent(150, 100)).toBe(100);
    expect(skillProgressPercent(-10, 100)).toBe(0);
    expect(skillProgressPercent(0, 0)).toBe(100);
  });

  it("allows an upgrade only when every rule is satisfied", () => {
    expect(
      skillUpgradeState({
        dataReady: true,
        busy: false,
        skillPoints: 1,
        value: 64,
        allocation: 6,
        cap: 20
      })
    ).toEqual({ disabled: false, reason: null, label: "AMÉLIORER · 1 POINT" });
  });

  it.each([
    [false, false, 1, 64, 6, "loading", "CHARGEMENT..."],
    [true, true, 1, 64, 6, "busy", "AMÉLIORATION..."],
    [true, false, 1, 100, 6, "stat-max", "STATISTIQUE AU MAXIMUM"],
    [true, false, 1, 64, 20, "skill-cap", "LIMITE 20/20 ATTEINTE"],
    [true, false, 0, 64, 6, "no-points", "AUCUN POINT DISPONIBLE"]
  ])(
    "blocks invalid upgrade states",
    (dataReady, busy, skillPoints, value, allocation, reason, label) => {
      expect(
        skillUpgradeState({
          dataReady,
          busy,
          skillPoints,
          value,
          allocation,
          cap: 20
        })
      ).toEqual({ disabled: true, reason, label });
    }
  );

  it.each([
    [9, 10, ["next", "locked", "locked", "locked", "locked"]],
    [10, 25, ["unlocked", "next", "locked", "locked", "locked"]],
    [24, 25, ["unlocked", "next", "locked", "locked", "locked"]],
    [25, 50, ["unlocked", "unlocked", "next", "locked", "locked"]],
    [49, 50, ["unlocked", "unlocked", "next", "locked", "locked"]],
    [50, 75, ["unlocked", "unlocked", "unlocked", "next", "locked"]],
    [74, 75, ["unlocked", "unlocked", "unlocked", "next", "locked"]],
    [75, 100, ["unlocked", "unlocked", "unlocked", "unlocked", "next"]],
    [99, 100, ["unlocked", "unlocked", "unlocked", "unlocked", "next"]],
    [100, null, ["unlocked", "unlocked", "unlocked", "unlocked", "unlocked"]]
  ])("resolves career milestone boundaries at level %i", (level, next, states) => {
    const result = careerMilestoneStates(level, [10, 25, 50, 75, 100]);
    expect(result.nextMilestone).toBe(next);
    expect(result.milestones.map(({ state }) => state)).toEqual(states);
    expect(result.allUnlocked).toBe(level === 100);
  });
});
