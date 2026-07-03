import { describe, expect, it } from "vitest";
import {
  ACTION_ENERGY_MAX,
  PLAYER_MAX_LEVEL,
  calculateOverall,
  getActionEnergySnapshot,
  playerLevelFromXp,
  playerLevelProgress,
  playerTotalXpForLevel,
  playerXpForNextLevel,
  recoverVitals,
  scaleDevelopmentCost,
  scaleDevelopmentMinutes,
  spendActionEnergy,
  trainingCardLevelForCopies,
  trainingCardProgress,
  trainingCardThreshold,
  trainingCardUnlockCost,
  trainingGain
} from "./index";

describe("progression carrière", () => {
  it("calcule un niveau général stable", () => {
    const stats = Object.fromEntries(
      [
        "service",
        "return",
        "forehand",
        "backhand",
        "volley",
        "smash",
        "dropShot",
        "stamina",
        "speed",
        "explosiveness",
        "strength",
        "recovery",
        "focus",
        "confidence",
        "composure",
        "fightingSpirit",
        "consistency",
        "aggression",
        "baseline",
        "netRush",
        "footwork",
        "surfaceAdaptation"
      ].map((key) => [key, 60])
    );
    expect(calculateOverall(stats)).toBe(60);
  });

  it("réduit les gains quand la fatigue est trop haute", () => {
    expect(trainingGain(1, 0.1, 0.05, 80)).toBeLessThan(trainingGain(1, 0.1, 0.05, 15));
  });

  it("récupère les jauges sans dépasser 100", () => {
    expect(recoverVitals({ energy: 98, fatigue: 5, health: 99, morale: 99 }, 3)).toEqual({
      energy: 100,
      fatigue: 0,
      health: 100,
      morale: 100
    });
  });

  it("recharge 1 point d'énergie carrière toutes les 30 minutes", () => {
    const snapshot = getActionEnergySnapshot(
      4,
      new Date("2026-06-24T10:00:00Z"),
      new Date("2026-06-24T11:01:00Z")
    );
    expect(snapshot.value).toBe(6);
    expect(snapshot.max).toBe(ACTION_ENERGY_MAX);
  });

  it("consomme 1 point d'énergie par action carrière", () => {
    expect(
      spendActionEnergy(2, new Date("2026-06-24T10:00:00Z"), new Date("2026-06-24T10:05:00Z"))
        .remaining
    ).toBe(1);
    expect(
      spendActionEnergy(0, new Date("2026-06-24T10:00:00Z"), new Date("2026-06-24T10:05:00Z")).spent
    ).toBe(false);
  });

  it("augmente coût et durée avec la puissance de développement", () => {
    expect(scaleDevelopmentCost(100, 4)).toBeGreaterThan(scaleDevelopmentCost(100, 2));
    expect(scaleDevelopmentMinutes(5, 4)).toBeGreaterThan(scaleDevelopmentMinutes(5, 2));
  });

  it("applique des paliers exponentiels aux cartes de statistiques", () => {
    expect(trainingCardThreshold(2)).toBeGreaterThan(trainingCardThreshold(1));
    expect(trainingCardLevelForCopies(0)).toBe(0);
    expect(trainingCardLevelForCopies(4)).toBe(1);
    expect(trainingCardProgress(4).copiesNeeded).toBeGreaterThan(
      trainingCardProgress(3).copiesNeeded
    );
  });

  it("fait payer les bonus de cartes avec un coût exponentiel", () => {
    expect(trainingCardUnlockCost(1)).toBe(1);
    expect(trainingCardUnlockCost(2)).toBeGreaterThan(trainingCardUnlockCost(1));
    expect(Number.isInteger(trainingCardUnlockCost(4))).toBe(true);
  });

  it("calcule une progression joueur bornee avec une courbe RPG", () => {
    expect(playerXpForNextLevel(1)).toBeGreaterThan(playerXpForNextLevel(0));
    expect(playerTotalXpForLevel(2)).toBe(
      playerXpForNextLevel(0) + playerXpForNextLevel(1)
    );
    expect(playerLevelFromXp(0)).toBe(0);
    expect(playerLevelFromXp(playerTotalXpForLevel(1))).toBe(1);
    expect(playerLevelFromXp(Number.MAX_SAFE_INTEGER)).toBe(PLAYER_MAX_LEVEL);
    expect(playerLevelProgress(playerTotalXpForLevel(3) + 5)).toMatchObject({
      level: 3,
      xpIntoLevel: 5
    });
  });
});
