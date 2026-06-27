import { describe, expect, it } from "vitest";
import { createStatsForArchetype } from "@mypro/sports-tennis";
import {
  hasWonGame,
  hasWonSet,
  pointWinProbability,
  pointsToLabel,
  simulateMatch,
  type EnginePlayer
} from "../src";

const player = (id: string, name: string, archetype: string, patch: Partial<EnginePlayer> = {}): EnginePlayer => ({
  id,
  name,
  stats: createStatsForArchetype(archetype),
  matchEnergy: 5,
  energy: 85,
  morale: 70,
  fatigue: 12,
  health: 95,
  confidence: 65,
  recentForm: 60,
  tactic: "Équilibré",
  risk: "Normale",
  ...patch
});

describe("score tennis", () => {
  it("calcule les libellés de score avec avantage", () => {
    expect(pointsToLabel([0, 0], false)).toEqual(["0", "0"]);
    expect(pointsToLabel([3, 3], false)).toEqual(["40", "40"]);
    expect(pointsToLabel([4, 3], false)).toEqual(["Av.", "40"]);
  });

  it("détecte le gain de jeu et le tie-break", () => {
    expect(hasWonGame([4, 2], false)).toBe(0);
    expect(hasWonGame([6, 6], true)).toBeNull();
    expect(hasWonGame([8, 6], true)).toBe(0);
  });

  it("détecte la victoire de set", () => {
    expect(hasWonSet([6, 4], null)).toBe(0);
    expect(hasWonSet([6, 6], null)).toBeNull();
    expect(hasWonSet([7, 6], 1)).toBe(1);
  });
});

describe("moteur de match", () => {
  it("produit un match terminé", () => {
    const result = simulateMatch({
      playerA: player("a", "Camille Varenne", "Joueur complet"),
      playerB: player("b", "Noé Silva", "Relanceur"),
      surface: "Dur",
      format: "Un set",
      seed: "mvp"
    });
    expect(result.events.length).toBeGreaterThan(20);
    expect(result.finalScore.sets[0] + result.finalScore.sets[1]).toBe(1);
    expect(result.scoreText).toMatch(/\d-\d/);
  });

  it("reste déterministe avec une seed", () => {
    const input = {
      playerA: player("a", "Camille Varenne", "Gros service"),
      playerB: player("b", "Noé Silva", "Athlète endurant"),
      surface: "Gazon" as const,
      format: "Deux sets gagnants" as const,
      seed: "stable-42"
    };
    expect(simulateMatch(input).scoreText).toBe(simulateMatch(input).scoreText);
    expect(simulateMatch(input).events[8]?.comment).toBe(simulateMatch(input).events[8]?.comment);
  });

  it("applique l'effet de fatigue", () => {
    const fresh = player("a", "Joueur frais", "Frappeur de fond", { fatigue: 5, energy: 92 });
    const tired = player("b", "Joueur usé", "Frappeur de fond", { fatigue: 80, energy: 35 });
    const probability = pointWinProbability(fresh, tired, "Dur", 0);
    expect(probability).toBeGreaterThan(0.58);
  });

  it("applique l'effet de surface", () => {
    const server = player("a", "Serveur", "Gros service", { tactic: "Service-volée" });
    const defender = player("b", "Défenseur", "Athlète endurant", { tactic: "Défensif" });
    expect(pointWinProbability(server, defender, "Gazon", 0)).toBeGreaterThan(
      pointWinProbability(server, defender, "Terre battue", 0)
    );
  });

  it("valorise le service", () => {
    const strong = player("a", "Serveur", "Gros service");
    const weak = player("b", "Retourneur", "Joueur complet", {
      stats: { ...createStatsForArchetype("Joueur complet"), service: 1 }
    });
    expect(pointWinProbability(strong, weak, "Indoor", 0)).toBeGreaterThan(0.52);
  });

  it("garde un match a niveau egal dans une zone jouable", () => {
    const a = player("a", "Joueur A", "Joueur complet");
    const b = player("b", "Joueur B", "Joueur complet");
    const probability = pointWinProbability(a, b, "Dur", 0);
    expect(probability).toBeGreaterThan(0.5);
    expect(probability).toBeLessThan(0.54);
  });

  it("attribue chaque point par comparaison miroir stat plus energie", () => {
    const result = simulateMatch({
      playerA: player("a", "Joueur énergique", "Joueur complet", { matchEnergy: 10 }),
      playerB: player("b", "Joueur à court d'énergie", "Joueur complet", { matchEnergy: 0 }),
      surface: "Dur",
      format: "Un set",
      seed: "energie-miroir"
    });
    expect(result.events.every((event) => event.winnerId === "a")).toBe(true);
    expect(result.events.every((event) => event.statValues && event.statValues[0] - event.statValues[1] === 10)).toBe(true);
  });
});
