import { afterAll, describe, expect, it } from "vitest";
import { calculateOverall } from "@mypro/core";
import { prisma } from "@mypro/database";
import { STARTER_COACH_DECK_CARD_IDS } from "@mypro/match-engine-tennis";
import { createStatsForArchetype } from "@mypro/sports-tennis";
import {
  abandonInteractiveMatchSession,
  coachInteractiveMatchSession,
  createInteractiveMatchSession,
  getInteractiveMatchSession,
  playCoachDeckCardSession,
  saveInteractiveMatchFeedback
} from "./interactiveMatches";

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const testEmail = `interactive-${suffix}@example.test`;
let userId: string | null = null;
let playerAId: string | null = null;
let playerBId: string | null = null;

async function cleanup() {
  const playerIds = [playerAId, playerBId].filter((id): id is string => Boolean(id));
  if (playerIds.length) {
    await prisma.match.deleteMany({
      where: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] }
    });
    await prisma.interactiveMatchSession.deleteMany({
      where: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] }
    });
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
  }
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("sessions de match interactif", () => {
  it("sauvegarde, protège et finalise une session une seule fois", async () => {
    const statsA = createStatsForArchetype("Joueur complet");
    const statsB = createStatsForArchetype("Relanceur");
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: "test-only",
        displayName: "Coach Test"
      }
    });
    userId = user.id;
    const playerA = await prisma.player.create({
      data: {
        userId: user.id,
        firstName: "Alex",
        lastName: "Test",
        nationality: "FR",
        gender: "Homme",
        dominantHand: "Droite",
        backhand: "Deux mains",
        archetype: "Joueur complet",
        avatar: "{}",
        stats: JSON.stringify(statsA),
        overall: calculateOverall(statsA)
      }
    });
    playerAId = playerA.id;
    const playerB = await prisma.player.create({
      data: {
        firstName: "Luca",
        lastName: "Test",
        nationality: "IT",
        gender: "Homme",
        dominantHand: "Droite",
        backhand: "Deux mains",
        archetype: "Relanceur",
        avatar: "{}",
        isAi: true,
        stats: JSON.stringify(statsB),
        overall: calculateOverall(statsB)
      }
    });
    playerBId = playerB.id;

    const created = await createInteractiveMatchSession({
      playerA,
      playerB,
      surface: "Dur",
      tactic: "Équilibré",
      risk: "Normale",
      format: "Un set",
      type: "Duel interactif de test"
    });
    expect(created.created).toBe(true);
    expect(created.session.status).toBe("ACTIVE");
    expect(created.session.matchState.status).toBe("AWAITING_COACH");
    expect(created.session.matchState).not.toHaveProperty("seed");
    expect(created.session.matchState).not.toHaveProperty("players");

    const initialRevision = created.session.revision;
    let session = await coachInteractiveMatchSession({
      sessionId: created.session.id,
      userId: user.id,
      revision: initialRevision,
      instructionId: "attack-backhand"
    });
    await expect(
      coachInteractiveMatchSession({
        sessionId: created.session.id,
        userId: user.id,
        revision: initialRevision,
        instructionId: null
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    let guard = 0;
    while (session.status === "ACTIVE" && guard < 200) {
      session = await coachInteractiveMatchSession({
        sessionId: session.id,
        userId: user.id,
        revision: session.revision,
        instructionId: null
      });
      guard += 1;
    }

    expect(session.status).toBe("FINISHED");
    expect(session.completedMatchId).toBeTruthy();
    const completedMatchId = session.completedMatchId;
    if (!completedMatchId) throw new Error("Le match finalisé est introuvable.");
    expect(session.matchState.status).toBe("FINISHED");
    expect(session.matchState.events.length).toBeGreaterThan(20);
    expect(await prisma.match.count({ where: { id: completedMatchId } })).toBe(1);

    const repeated = await coachInteractiveMatchSession({
      sessionId: session.id,
      userId: user.id,
      revision: session.revision,
      instructionId: null
    });
    expect(repeated.completedMatchId).toBe(session.completedMatchId);
    expect(await prisma.match.count({ where: { id: completedMatchId } })).toBe(1);

    const resumed = await getInteractiveMatchSession(session.id, user.id);
    expect(resumed.revision).toBe(session.revision);
    await expect(getInteractiveMatchSession(session.id, "autre-utilisateur")).rejects.toMatchObject(
      {
        statusCode: 404
      }
    );

    const feedback = await saveInteractiveMatchFeedback({
      sessionId: session.id,
      userId: user.id,
      balance: "BALANCED",
      enjoyment: 5,
      viewport: "MOBILE_LANDSCAPE",
      comment: "Match tactique et lisible."
    });
    expect(feedback).toMatchObject({
      balance: "BALANCED",
      enjoyment: 5,
      viewport: "MOBILE_LANDSCAPE"
    });
    const updatedFeedback = await saveInteractiveMatchFeedback({
      sessionId: session.id,
      userId: user.id,
      balance: "TOO_HARD",
      viewport: "DESKTOP",
      comment: "Deuxième avis."
    });
    expect(updatedFeedback.balance).toBe("TOO_HARD");
    expect(await prisma.interactiveMatchFeedback.count({ where: { sessionId: session.id } })).toBe(
      1
    );
    await expect(
      saveInteractiveMatchFeedback({
        sessionId: session.id,
        userId: "autre-utilisateur",
        balance: "BALANCED",
        viewport: "OTHER",
        comment: ""
      })
    ).rejects.toMatchObject({ statusCode: 404 });

    const refreshedPlayerA = await prisma.player.findUniqueOrThrow({ where: { id: playerA.id } });
    const refreshedPlayerB = await prisma.player.findUniqueOrThrow({ where: { id: playerB.id } });
    const lossesBeforeAbandon = refreshedPlayerA.losses;
    const winsBeforeAbandon = refreshedPlayerB.wins;
    const second = await createInteractiveMatchSession({
      playerA: refreshedPlayerA,
      playerB: refreshedPlayerB,
      surface: "Dur",
      tactic: "Équilibré",
      risk: "Normale",
      format: "Un set",
      type: "Abandon interactif de test"
    });
    const abandoned = await abandonInteractiveMatchSession({
      sessionId: second.session.id,
      userId: user.id,
      revision: second.session.revision
    });
    const playersAfterAbandon = await prisma.player.findMany({
      where: { id: { in: [playerA.id, playerB.id] } }
    });
    const loserAfterAbandon = playersAfterAbandon.find((item) => item.id === playerA.id);
    const winnerAfterAbandon = playersAfterAbandon.find((item) => item.id === playerB.id);

    expect(abandoned.status).toBe("ABANDONED");
    expect(abandoned.completedMatchId).toBeTruthy();
    expect(loserAfterAbandon?.losses).toBe(lossesBeforeAbandon + 1);
    expect(winnerAfterAbandon?.wins).toBe(winsBeforeAbandon + 1);

    const deckPlayerA = await prisma.player.findUniqueOrThrow({ where: { id: playerA.id } });
    const deckPlayerB = await prisma.player.findUniqueOrThrow({ where: { id: playerB.id } });
    const deckMatch = await createInteractiveMatchSession({
      playerA: deckPlayerA,
      playerB: deckPlayerB,
      surface: "Dur",
      tactic: "Équilibré",
      risk: "Normale",
      format: "Un set",
      type: "Coach Deck de test",
      coachDeckCardIds: STARTER_COACH_DECK_CARD_IDS,
      coachDeckCardVariants: { "power-forehand": "IMPACT" }
    });
    expect(deckMatch.session.coachCards).toHaveLength(24);
    expect(deckMatch.session.coachIntents).toHaveLength(8);
    expect(deckMatch.session.matchState.coachDeck?.hand).toHaveLength(4);
    const runtimeCards = [
      ...(deckMatch.session.matchState.coachDeck?.hand ?? []),
      ...(deckMatch.session.matchState.coachDeck?.drawPile ?? [])
    ];
    expect(runtimeCards.find((card) => card.cardId === "power-forehand")?.variantId).toBe("IMPACT");
    const firstCard = deckMatch.session.matchState.coachDeck?.hand[0];
    expect(firstCard).toBeDefined();
    const deckRevision = deckMatch.session.revision;
    let deckSession = await playCoachDeckCardSession({
      sessionId: deckMatch.session.id,
      userId: user.id,
      revision: deckRevision,
      cardInstanceId: firstCard!.instanceId
    });
    await expect(
      playCoachDeckCardSession({
        sessionId: deckMatch.session.id,
        userId: user.id,
        revision: deckRevision,
        cardInstanceId: null
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    let deckGuard = 0;
    while (deckSession.status === "ACTIVE" && deckGuard < 200) {
      deckSession = await playCoachDeckCardSession({
        sessionId: deckSession.id,
        userId: user.id,
        revision: deckSession.revision,
        cardInstanceId: null
      });
      deckGuard += 1;
    }
    expect(deckSession.status).toBe("FINISHED");
    expect(deckSession.matchState.coachDeck?.history.length).toBeGreaterThan(0);
    expect(deckSession.coachDeckRewards?.totalMasteryXp).toBeGreaterThan(0);
    expect(deckSession.coachDeckRewards?.cards.length).toBeGreaterThan(0);
    const rewardedCardId = deckSession.coachDeckRewards!.cards[0]!.cardId;
    const masteryAfterFinish = await prisma.playerCoachCard.findUniqueOrThrow({
      where: { playerId_cardId: { playerId: playerA.id, cardId: rewardedCardId } }
    });
    const repeatedFinish = await playCoachDeckCardSession({
      sessionId: deckSession.id,
      userId: user.id,
      revision: deckSession.revision,
      cardInstanceId: null
    });
    const masteryAfterRetry = await prisma.playerCoachCard.findUniqueOrThrow({
      where: { playerId_cardId: { playerId: playerA.id, cardId: rewardedCardId } }
    });
    expect(repeatedFinish.coachDeckRewards).toEqual(deckSession.coachDeckRewards);
    expect(masteryAfterRetry.masteryXp).toBe(masteryAfterFinish.masteryXp);
  });
});
