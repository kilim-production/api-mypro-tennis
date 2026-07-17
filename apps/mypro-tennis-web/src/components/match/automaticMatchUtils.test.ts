import { describe, expect, it } from "vitest";
import {
  actionInsight,
  formatAutomaticAction,
  formatReplayClock,
  momentumPosition,
  pointForceRatio,
  timelineWindow
} from "./automaticMatchUtils";

describe("automatic match presentation helpers", () => {
  it("transforms engine actions into clear broadcast labels", () => {
    expect(formatAutomaticAction("coup droit croisé")).toBe("Coup droit décisif");
    expect(formatAutomaticAction("ace")).toBe("Ace imparable");
  });

  it("keeps the force ratio complementary", () => {
    expect(pointForceRatio([70, 60])).toEqual([54, 46]);
    expect(pointForceRatio([0, 0])).toEqual([50, 50]);
  });

  it("maps engine momentum to the full visual track", () => {
    expect(momentumPosition(-0.035)).toBe(0);
    expect(momentumPosition(0)).toBe(50);
    expect(momentumPosition(0.035)).toBe(100);
  });

  it("keeps the current point inside a bounded timeline window", () => {
    expect(timelineWindow(100, 50, 20)).toEqual(Array.from({ length: 20 }, (_, i) => 38 + i));
    expect(timelineWindow(5, 4, 20)).toEqual([0, 1, 2, 3, 4]);
  });

  it("formats replay time from the server duration", () => {
    expect(formatReplayClock(6, 49, 99)).toEqual({ current: "03:00", total: "06:00" });
  });

  it("explains the decisive bonus in plain language", () => {
    expect(
      actionInsight({
        winnerName: "Alex",
        loserName: "Mila",
        statLabel: "Coup droit",
        winnerValue: 70,
        loserValue: 60,
        bonus: 3
      })
    ).toContain("forme (+3)");
  });
});
