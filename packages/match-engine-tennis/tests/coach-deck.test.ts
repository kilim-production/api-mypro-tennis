import { createStatsForArchetype } from "@mypro/sports-tennis";
import { describe, expect, it } from "vitest";
import {
  COACH_CARDS,
  COACH_DECK_MAX_POINT_CHANCE_DELTA,
  COACH_DECK_PROFILE_STAT_KEYS,
  OPPONENT_INTENTS,
  STARTER_COACH_DECK_CARD_IDS,
  advanceInteractiveMatch,
  applyCoachDeckDecision,
  coachCardById,
  coachCardFocusCost,
  coachCardMasteryProgress,
  coachDeckAiTierForRanking,
  createInteractiveMatch,
  generateOpponentIntent,
  previewCoachCard,
  simulateCoachDeckBalance,
  validateCoachDeck,
  type CoachCardFamily,
  type CoachDeckProfileStats,
  type EnginePlayer
} from "../src";

function profileStats(value?: number): CoachDeckProfileStats {
  const stats = createStatsForArchetype("Joueur complet");
  return Object.fromEntries(
    COACH_DECK_PROFILE_STAT_KEYS.map((key) => [key, value ?? stats[key]])
  ) as CoachDeckProfileStats;
}

function enginePlayer(id: string): EnginePlayer {
  return {
    id,
    name: id === "a" ? "Alex Moreau" : "Julien Martin",
    stats: createStatsForArchetype("Joueur complet"),
    matchEnergy: 5,
    energy: 85,
    morale: 70,
    fatigue: 12,
    health: 95,
    confidence: 65,
    recentForm: 60,
    tactic: "Équilibré",
    risk: "Normale"
  };
}

describe("catalogue Coach Deck", () => {
  it("contient exactement 24 cartes réparties dans les quatre familles", () => {
    const counts: Record<CoachCardFamily, number> = {
      BOOST: 0,
      COUNTER: 0,
      STATE: 0,
      DECK: 0
    };
    for (const card of COACH_CARDS) counts[card.family] += 1;

    expect(COACH_CARDS).toHaveLength(24);
    expect(new Set(COACH_CARDS.map((card) => card.id)).size).toBe(24);
    expect(counts).toEqual({ BOOST: 8, COUNTER: 6, STATE: 6, DECK: 4 });
  });

  it("relie clairement chacune des 12 statistiques du profil à au moins une carte", () => {
    const coveredStats = new Set(
      COACH_CARDS.flatMap((card) => [...card.primaryStats, ...card.secondaryStats])
    );

    for (const key of COACH_DECK_PROFILE_STAT_KEYS) expect(coveredStats.has(key)).toBe(true);
  });

  it("fournit un deck de départ valide de 12 cartes", () => {
    const validation = validateCoachDeck(STARTER_COACH_DECK_CARD_IDS, { playerLevel: 0 });

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.familyCounts.BOOST).toBeGreaterThan(0);
    expect(validation.familyCounts.COUNTER).toBeGreaterThan(0);
    expect(validation.familyCounts.STATE).toBeGreaterThan(0);
    expect(validation.familyCounts.DECK).toBeGreaterThan(0);
  });

  it("refuse une taille, une copie ou un niveau invalide", () => {
    expect(validateCoachDeck(["power-forehand"]).valid).toBe(false);
    expect(
      validateCoachDeck(Array.from({ length: 12 }, () => "power-forehand")).errors.some((error) =>
        error.includes("limitée")
      )
    ).toBe(true);
    expect(
      validateCoachDeck([...STARTER_COACH_DECK_CARD_IDS.slice(0, 11), "fresh-start"], {
        playerLevel: 0
      }).errors.some((error) => error.includes("niveau 10"))
    ).toBe(true);
  });
});

describe("effets Coach Deck", () => {
  it("rend une carte technique plus efficace avec de meilleures statistiques", () => {
    const card = coachCardById("power-forehand");
    expect(card).not.toBeNull();
    const developing = previewCoachCard(card!, profileStats(40), { basePointChance: 0.5 });
    const expert = previewCoachCard(card!, profileStats(90), { basePointChance: 0.5 });

    expect(expert.effectiveness).toBeGreaterThan(developing.effectiveness);
    expect(expert.pointChanceDelta).toBeGreaterThan(developing.pointChanceDelta);
    expect(expert.scaledStatBoosts.forehand).toBeGreaterThan(
      developing.scaledStatBoosts.forehand ?? 0
    );
  });

  it("récompense un contre qui répond à l’intention adverse", () => {
    const card = coachCardById("protect-backhand");
    expect(card).not.toBeNull();
    const matched = previewCoachCard(card!, profileStats(65), {
      opponentIntentId: "ATTACK_BACKHAND",
      basePointChance: 0.47
    });
    const missed = previewCoachCard(card!, profileStats(65), {
      opponentIntentId: "SERVE_PRESSURE",
      basePointChance: 0.47
    });

    expect(matched.intentMatched).toBe(true);
    expect(missed.intentMatched).toBe(false);
    expect(matched.pointChanceDelta).toBeGreaterThan(missed.pointChanceDelta + 0.02);
  });

  it("ne transforme pas les cartes de contrôle du deck en bonus de score caché", () => {
    const card = coachCardById("read-the-game");
    expect(card).not.toBeNull();
    const preview = previewCoachCard(card!, profileStats(70), { basePointChance: 0.51 });

    expect(preview.pointChanceDelta).toBe(0);
    expect(preview.draw).toBe(1);
    expect(preview.revealIntentPrecision).toBeGreaterThan(0);
  });

  it("plafonne toujours l’impact direct d’une carte", () => {
    for (const card of COACH_CARDS) {
      const preview = previewCoachCard(card, profileStats(100), {
        opponentIntentId: "ATTACK_BACKHAND",
        basePointChance: 0.5,
        currentMomentum: -100
      });
      expect(Math.abs(preview.pointChanceDelta)).toBeLessThanOrEqual(
        COACH_DECK_MAX_POINT_CHANCE_DELTA
      );
    }
  });

  it("fait progresser la maîtrise selon des paliers lisibles", () => {
    expect(coachCardMasteryProgress(0)).toMatchObject({ level: 0, nextLevelXp: 30 });
    expect(coachCardMasteryProgress(30)).toMatchObject({ level: 1, nextLevelXp: 90 });
    expect(coachCardMasteryProgress(200)).toMatchObject({
      level: 3,
      nextLevelXp: null,
      progress: 1
    });
  });

  it("propose des variantes latérales avec une contrepartie de Focus", () => {
    const card = coachCardById("power-forehand");
    expect(card).not.toBeNull();
    const standard = previewCoachCard(card!, profileStats(70), { basePointChance: 0.5 });
    const impact = previewCoachCard(card!, profileStats(70), {
      basePointChance: 0.5,
      variantId: "IMPACT"
    });
    const flow = previewCoachCard(card!, profileStats(70), {
      basePointChance: 0.5,
      variantId: "FLOW"
    });

    expect(impact.pointChanceDelta).toBeGreaterThan(standard.pointChanceDelta);
    expect(impact.focusCost).toBe(coachCardFocusCost(card!, "IMPACT"));
    expect(impact.focusCost).toBeGreaterThan(standard.focusCost);
    expect(flow.pointChanceDelta).toBeLessThan(standard.pointChanceDelta);
    expect(flow.focusCost).toBeLessThan(standard.focusCost);
  });
});

describe("intentions adverses", () => {
  it("décrit huit plans adverses possédant chacun une réponse recommandée", () => {
    expect(OPPONENT_INTENTS).toHaveLength(8);
    expect(OPPONENT_INTENTS.every((intent) => intent.recommendedCardIds.length > 0)).toBe(true);
    expect(
      OPPONENT_INTENTS.flatMap((intent) => intent.recommendedCardIds).every(
        (cardId) => coachCardById(cardId) !== null
      )
    ).toBe(true);
  });

  it("génère la même intention pour la même session", () => {
    const input = {
      playerStats: profileStats(58),
      opponentStats: profileStats(72),
      opponentRanking: "15/3",
      playerEnergy: 55,
      opponentEnergy: 70,
      momentum: -18,
      seed: "intent-resume",
      windowIndex: 3
    };

    expect(generateOpponentIntent(input)).toEqual(generateOpponentIntent(input));
  });

  it("augmente la précision tactique avec le classement sans cacher l’intention", () => {
    expect(coachDeckAiTierForRanking("NC")).toBe("BEGINNER");
    expect(coachDeckAiTierForRanking("-15")).toBe("ELITE");
    const beginner = generateOpponentIntent({
      playerStats: profileStats(60),
      opponentStats: profileStats(70),
      opponentRanking: "NC",
      playerEnergy: 50,
      opponentEnergy: 70,
      momentum: -35,
      seed: "ranking-intent",
      windowIndex: 1
    });
    const elite = generateOpponentIntent({
      playerStats: profileStats(60),
      opponentStats: profileStats(70),
      opponentRanking: "-15",
      playerEnergy: 50,
      opponentEnergy: 70,
      momentum: -35,
      seed: "ranking-intent",
      windowIndex: 1
    });

    expect(elite.id).toBe(beginner.id);
    expect(elite.confidence).toBeGreaterThan(beginner.confidence);
    expect(elite.intensity).toBe(3);
  });
});

describe("simulation d’équilibrage Coach Deck", () => {
  it("analyse 10 000 situations sans dépasser la limite de sécurité", () => {
    const report = simulateCoachDeckBalance(10_000);

    expect(report.simulatedMatches).toBe(10_000);
    expect(report.cardsAboveSafetyLimit).toEqual([]);
    expect(report.maximumObservedPointChanceDelta).toBeLessThanOrEqual(
      COACH_DECK_MAX_POINT_CHANCE_DELTA
    );
    expect(report.minimumObservedPointChanceDelta).toBeGreaterThanOrEqual(
      -COACH_DECK_MAX_POINT_CHANCE_DELTA
    );
    expect(Object.keys(report.averagePointChanceDeltaByCard)).toHaveLength(24);
  });
});

describe("Coach Deck dans le moteur de match", () => {
  function deckMatch(seed = "coach-deck-runtime") {
    return createInteractiveMatch({
      playerA: enginePlayer("a"),
      playerB: enginePlayer("b"),
      surface: "Dur",
      format: "Deux sets gagnants",
      seed,
      coachDeckCardIds: STARTER_COACH_DECK_CARD_IDS,
      opponentRanking: "30/2"
    });
  }

  it("prépare une main et une intention identiques après une reprise", () => {
    const first = deckMatch("deterministic-hand");
    const second = deckMatch("deterministic-hand");

    expect(first.coachDeck?.hand).toHaveLength(4);
    expect(first.coachDeck?.hand).toEqual(second.coachDeck?.hand);
    expect(first.coachDeck?.opponentIntent).toEqual(second.coachDeck?.opponentIntent);
    expect(first.coachDeck?.focus).toBe(5);
  });

  it("dépense le Focus, conserve le choix et influence temporairement les points", () => {
    const initial = deckMatch("played-card");
    const playable = initial.coachDeck?.hand.find(
      (instance) => coachCardById(instance.cardId)?.family !== "DECK"
    );
    expect(playable).toBeDefined();
    const card = coachCardById(playable!.cardId)!;
    const coached = applyCoachDeckDecision(initial, playable!.instanceId);

    expect(coached.coachDeck?.focus).toBe(5 - card.focusCost);
    expect(coached.coachDeck?.history.at(-1)?.cardId).toBe(card.id);
    expect(coached.coachDeck?.hand).toHaveLength(0);

    const advanced = advanceInteractiveMatch(coached, 1);
    expect(advanced.events).toHaveLength(1);
    expect(Math.abs(advanced.events[0]!.probabilityBreakdown.coachDeck)).toBeGreaterThan(0);
    expect(advanced.events[0]!.activeCoachCardIds).toContain(card.id);
  });

  it("permet de laisser jouer gratuitement et reprend exactement la même simulation", () => {
    const initial = deckMatch("deck-save-resume");
    const playing = applyCoachDeckDecision(initial, null);
    const restored = JSON.parse(JSON.stringify(playing)) as typeof playing;

    expect(playing.coachDeck?.focus).toBe(5);
    expect(playing.coachDeck?.history.at(-1)?.cardId).toBeNull();
    expect(advanceInteractiveMatch(restored)).toEqual(advanceInteractiveMatch(playing));
  });
});
