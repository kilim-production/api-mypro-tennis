import { describe, expect, it } from "vitest";
import {
  DUEL_POOL_SIZE,
  duelOverallRange,
  duelPoolSlotIsValid,
  isWithinDuelOverallRange,
  orderDuelPoolCandidates
} from "./duelPool";

describe("pool du mode duel", () => {
  it("recherche trois adversaires dans un delta de cinq points", () => {
    expect(DUEL_POOL_SIZE).toBe(3);
    expect(duelOverallRange(52)).toEqual({ min: 47, max: 57, delta: 5 });
    expect(isWithinDuelOverallRange(52, 47)).toBe(true);
    expect(isWithinDuelOverallRange(52, 57)).toBe(true);
    expect(isWithinDuelOverallRange(52, 58)).toBe(false);
  });

  it("borne la fourchette aux limites de la note globale", () => {
    expect(duelOverallRange(2)).toEqual({ min: 0, max: 7, delta: 5 });
    expect(duelOverallRange(99)).toEqual({ min: 94, max: 100, delta: 5 });
  });

  it("priorise les profils réels puis ceux qui ont été le moins affrontés", () => {
    const history = new Map([
      ["real-played", { count: 1, lastPlayedAt: new Date("2026-07-17T10:00:00Z") }],
      ["ai-new", { count: 0, lastPlayedAt: null }]
    ]);
    const ordered = orderDuelPoolCandidates(
      [
        { id: "ai-new", isAi: true },
        { id: "real-played", isAi: false },
        { id: "real-new", isAi: false }
      ],
      history,
      "player-1"
    );
    expect(ordered.map((candidate) => candidate.id)).toEqual(["real-new", "real-played", "ai-new"]);
  });

  it("conserve un emplacement uniquement tant que l'adversaire n'a pas été joué", () => {
    expect(
      duelPoolSlotIsValid({
        playerOverall: 50,
        opponentOverall: 55,
        dailyLimitReached: false,
        playedSinceAssigned: false
      })
    ).toBe(true);
    expect(
      duelPoolSlotIsValid({
        playerOverall: 50,
        opponentOverall: 55,
        dailyLimitReached: false,
        playedSinceAssigned: true
      })
    ).toBe(false);
  });

  it("retire les profils hors fourchette ou déjà joués deux fois dans la journée", () => {
    expect(
      duelPoolSlotIsValid({
        playerOverall: 50,
        opponentOverall: 56,
        dailyLimitReached: false,
        playedSinceAssigned: false
      })
    ).toBe(false);
    expect(
      duelPoolSlotIsValid({
        playerOverall: 50,
        opponentOverall: 50,
        dailyLimitReached: true,
        playedSinceAssigned: false
      })
    ).toBe(false);
  });
});
