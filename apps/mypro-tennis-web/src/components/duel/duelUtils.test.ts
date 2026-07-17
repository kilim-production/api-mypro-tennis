import { describe, expect, it } from "vitest";
import type { Player } from "../../store";
import {
  duelDifficulty,
  duelEnergyPercent,
  duelPlayerStyle,
  duelTacticalRead,
  duelTopStats,
  formatDuelCredits
} from "./duelUtils";

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Alex Moreau",
    firstName: "Alex",
    lastName: "Moreau",
    nationality: "FR",
    gender: "Homme",
    dominantHand: "Droite",
    backhand: "Deux mains",
    archetype: "Joueur complet",
    avatar: "AM",
    isAi: false,
    stats: {
      service: 64,
      return: 58,
      forehand: 67,
      backhand: 61,
      volley: 55,
      smash: 60,
      dropShot: 52,
      stamina: 66,
      speed: 63,
      explosiveness: 62,
      strength: 65,
      recovery: 59
    },
    actionEnergy: 9,
    actionEnergyMax: 10,
    actionEnergyNextAt: null,
    actionEnergyUpdatedAt: "2026-07-17T00:00:00.000Z",
    energy: 100,
    morale: 100,
    fatigue: 0,
    health: 100,
    reputation: 0,
    budget: 14829,
    gems: 29,
    careerCashPrizeWon: 0,
    playerLevel: 16,
    playerXp: 0,
    skillPoints: 0,
    spentSkillPoints: 0,
    overall: 64,
    rankingPoints: 0,
    worldRank: 999,
    fftRanking: "15/2",
    fftRankingValidated: true,
    amateurPoints: 0,
    careerStage: "Amateur",
    proUnlocked: false,
    wins: 18,
    losses: 7,
    ...overrides
  };
}

describe("duel utilities", () => {
  it("selects the three strongest profile statistics", () => {
    expect(duelTopStats(player()).map((stat) => stat.key)).toEqual([
      "forehand",
      "stamina",
      "strength"
    ]);
  });

  it("classifies close opponents as balanced", () => {
    expect(duelDifficulty(player(), player({ overall: 62 }))).toEqual({
      label: "Match équilibré",
      tone: "balanced"
    });
  });

  it("finds the clearest advantage and the strongest opposing threat", () => {
    const opponent = player({
      id: "opponent-1",
      stats: { ...player().stats, forehand: 60, return: 63, stamina: 65 }
    });
    const reading = duelTacticalRead(player(), opponent);

    expect(reading.advantage.key).toBe("forehand");
    expect(reading.advantage.difference).toBe(7);
    expect(reading.danger.key).toBe("return");
  });

  it("derives energy, style and credits for the interface", () => {
    expect(duelEnergyPercent(player())).toBe(90);
    expect(duelPlayerStyle(player())).toBe("Joueur complet");
    expect(formatDuelCredits(14829)).toContain("14");
    expect(formatDuelCredits(14829).endsWith("CR")).toBe(true);
  });
});
