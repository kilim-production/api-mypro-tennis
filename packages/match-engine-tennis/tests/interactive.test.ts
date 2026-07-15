import { describe, expect, it } from "vitest";
import { createStatsForArchetype } from "@mypro/sports-tennis";
import {
  COACHING_INSTRUCTIONS,
  advanceInteractiveMatch,
  applyCoachingDecision,
  createInteractiveMatch,
  runInteractiveMatchAutomatically,
  type CreateInteractiveMatchInput,
  type EnginePlayer
} from "../src";

function player(
  id: string,
  name: string,
  archetype: string,
  patch: Partial<EnginePlayer> = {}
): EnginePlayer {
  return {
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
  };
}

function matchInput(seed = "coach-v2"): CreateInteractiveMatchInput {
  return {
    playerA: player("a", "Alex Moreau", "Joueur complet"),
    playerB: player("b", "Luca Moretti", "Joueur complet"),
    surface: "Dur",
    format: "Un set",
    seed
  };
}

function boostedPlayer(id: string, boost: number) {
  const base = player(id, id === "a" ? "Alex Moreau" : "Luca Moretti", "Joueur complet");
  const stats = { ...base.stats };
  for (const key of Object.keys(stats) as Array<keyof typeof stats>) {
    stats[key] = Math.min(99, stats[key] + boost);
  }
  return { ...base, stats };
}

describe("catalogue de coaching", () => {
  it("propose plus de six consignes et des choix symétriques", () => {
    const ids = COACHING_INSTRUCTIONS.map((instruction) => instruction.id);
    expect(COACHING_INSTRUCTIONS.length).toBeGreaterThan(6);
    expect(ids).toContain("attack-backhand");
    expect(ids).toContain("attack-forehand");
    expect(ids).toContain("extend-rallies");
    expect(ids).toContain("shorten-rallies");
    expect(ids).toContain("play-safe");
    expect(ids).toContain("take-risks");
  });
});

describe("moteur de match interactif", () => {
  it("commence par un plan de match avec trois points de coaching", () => {
    const state = createInteractiveMatch(matchInput());
    expect(state.status).toBe("AWAITING_COACH");
    expect(state.coachWindow?.type).toBe("PRE_MATCH");
    expect(state.coachWindow?.recommendedInstructionIds).toHaveLength(3);
    expect(state.coachingPoints[0]).toBe(3);
  });

  it("applique un plan initial gratuit et espace la prochaine décision", () => {
    const initial = createInteractiveMatch(matchInput());
    const coached = applyCoachingDecision(initial, "attack-backhand");
    const advanced = advanceInteractiveMatch(coached);

    expect(initial.coachingPoints[0]).toBe(3);
    expect(coached.coachingPoints[0]).toBe(3);
    expect(coached.activeInstructions[0]?.id).toBe("attack-backhand");
    expect(advanced.events.length).toBeGreaterThanOrEqual(12);
    expect(["AWAITING_COACH", "FINISHED"]).toContain(advanced.status);
  });

  it("permet de commencer sans plan et sans dépenser de point", () => {
    const initial = createInteractiveMatch(matchInput("no-forced-coaching"));
    const playing = applyCoachingDecision(initial, null);
    const advanced = advanceInteractiveMatch(playing);

    expect(playing.coachingPoints[0]).toBe(3);
    expect(playing.activeInstructions[0]).toBeNull();
    expect(advanced.events.length).toBeGreaterThanOrEqual(12);
  });

  it("ne dépense un point que pour une intervention choisie en cours de match", () => {
    const initial = createInteractiveMatch(matchInput("spaced-coaching"));
    const firstRun = advanceInteractiveMatch(applyCoachingDecision(initial, null));

    expect(firstRun.status).toBe("AWAITING_COACH");
    expect(firstRun.coachingPoints[0]).toBe(3);

    const eventCountAtDecision = firstRun.events.length;
    const instructed = applyCoachingDecision(firstRun, "play-safe");
    const secondRun = advanceInteractiveMatch(instructed);

    expect(instructed.coachingPoints[0]).toBe(2);
    expect(["AWAITING_COACH", "FINISHED"]).toContain(secondRun.status);
    expect(secondRun.events.length - eventCountAtDecision).toBeGreaterThanOrEqual(12);
  });

  it("reprend exactement le même match après sérialisation", () => {
    const initial = createInteractiveMatch(matchInput("save-and-resume"));
    const coached = applyCoachingDecision(initial, "vary-play");
    const restored = JSON.parse(JSON.stringify(coached)) as typeof coached;

    expect(advanceInteractiveMatch(restored)).toEqual(advanceInteractiveMatch(coached));
  });

  it("laisse une vraie incertitude et produit un match terminé", () => {
    const result = runInteractiveMatchAutomatically(matchInput("controlled-uncertainty"));
    const pointWinners = new Set(result.events.map((event) => event.winnerId));

    expect(result.status).toBe("FINISHED");
    expect(result.winnerId).not.toBeNull();
    expect(result.scoreText).toMatch(/\d-\d/);
    expect(result.events.length).toBeGreaterThan(20);
    expect(pointWinners.size).toBe(2);
    expect(result.events.every((event) => event.probabilityForPlayerA >= 0.18)).toBe(true);
    expect(result.events.every((event) => event.probabilityForPlayerA <= 0.82)).toBe(true);
    expect(result.events[0]?.probabilityBreakdown).toMatchObject({
      total: result.events[0]?.probabilityForPlayerA
    });
  });

  it("rend une consigne offensive plus favorable mais plus coûteuse en énergie", () => {
    const initial = createInteractiveMatch(matchInput("instruction-impact"));
    const aggressive = advanceInteractiveMatch(applyCoachingDecision(initial, "all-in"));
    const conservative = advanceInteractiveMatch(applyCoachingDecision(initial, "conserve-energy"));
    const aggressivePoint = aggressive.events[0];
    const conservativePoint = conservative.events[0];

    expect(aggressivePoint).toBeDefined();
    expect(conservativePoint).toBeDefined();
    expect(aggressivePoint!.probabilityForPlayerA).toBeGreaterThan(
      conservativePoint!.probabilityForPlayerA
    );
    expect(aggressivePoint!.energy[0]).toBeLessThan(conservativePoint!.energy[0]);
  });

  it("utilise directement la statistique de smash dans les points aériens", () => {
    let smashSeed = "";
    for (let index = 0; index < 100; index += 1) {
      const seed = `smash-pattern-${index}`;
      const state = advanceInteractiveMatch(
        applyCoachingDecision(createInteractiveMatch(matchInput(seed)), null),
        1
      );
      if (state.events[0]?.statKey === "smash") {
        smashSeed = seed;
        break;
      }
    }

    expect(smashSeed).not.toBe("");
    const baseInput = matchInput(smashSeed);
    const boostedStats = { ...baseInput.playerA.stats, smash: 99 };
    const regular = advanceInteractiveMatch(
      applyCoachingDecision(createInteractiveMatch(baseInput), null),
      1
    );
    const boosted = advanceInteractiveMatch(
      applyCoachingDecision(
        createInteractiveMatch({
          ...baseInput,
          playerA: { ...baseInput.playerA, stats: boostedStats }
        }),
        null
      ),
      1
    );

    expect(boosted.events[0]?.probabilityForPlayerA).toBeGreaterThan(
      regular.events[0]?.probabilityForPlayerA ?? 0
    );
  });

  it("garantit une énergie de départ jouable tout en récompensant une bonne condition", () => {
    const exhausted = createInteractiveMatch({
      ...matchInput("starting-energy-exhausted"),
      playerA: player("a", "Alex Moreau", "Joueur complet", {
        energy: 0,
        fatigue: 100,
        health: 0
      })
    });
    const fresh = createInteractiveMatch({
      ...matchInput("starting-energy-fresh"),
      playerA: player("a", "Alex Moreau", "Joueur complet", {
        energy: 100,
        fatigue: 0,
        health: 100
      })
    });

    expect(exhausted.energy[0]).toBe(40);
    expect(fresh.energy[0]).toBe(92);
    expect(fresh.energy[0]).toBeGreaterThan(exhausted.energy[0]);
  });

  it("ne recompte pas la fatigue après son intégration dans l’énergie de départ", () => {
    const state = createInteractiveMatch({
      ...matchInput("fatigue-counted-once"),
      playerA: player("a", "Alex Moreau", "Joueur complet", { fatigue: 100 }),
      playerB: player("b", "Luca Moretti", "Joueur complet", { fatigue: 0 })
    });
    state.energy = [70, 70];
    const advanced = advanceInteractiveMatch(applyCoachingDecision(state, null), 1);

    expect(advanced.events[0]?.probabilityBreakdown.physical).toBe(0);
  });

  it("garde les matchs équilibrés ouverts et permet de vrais exploits", () => {
    const sampleSize = 120;
    let equalWins = 0;
    let favoriteWins = 0;

    for (let index = 0; index < sampleSize; index += 1) {
      const equal = runInteractiveMatchAutomatically({
        ...matchInput(`balance-equal-${index}`),
        playerA: boostedPlayer("a", 0),
        playerB: boostedPlayer("b", 0)
      });
      const favorite = runInteractiveMatchAutomatically({
        ...matchInput(`balance-favorite-${index}`),
        playerA: boostedPlayer("a", 10),
        playerB: boostedPlayer("b", 0)
      });
      if (equal.winnerId === "a") equalWins += 1;
      if (favorite.winnerId === "a") favoriteWins += 1;
    }

    const equalRate = equalWins / sampleSize;
    const favoriteRate = favoriteWins / sampleSize;
    expect(equalRate).toBeGreaterThan(0.4);
    expect(equalRate).toBeLessThan(0.6);
    expect(favoriteRate).toBeGreaterThan(0.72);
    expect(favoriteRate).toBeLessThan(0.94);
  });
});
