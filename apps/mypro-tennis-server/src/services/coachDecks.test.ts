import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@mypro/database";
import { STARTER_COACH_DECK_CARD_IDS } from "@mypro/match-engine-tennis";
import {
  activateCoachDeck,
  awardCoachDeckMatchProgress,
  createCoachDeck,
  getCoachDeckState,
  selectCoachCardVariant,
  updateCoachDeck
} from "./coachDecks";

const suffix = randomUUID();
const email = `coach-deck-${suffix}@example.test`;
const legacyEmail = `coach-deck-legacy-${suffix}@example.test`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [email, legacyEmail] } } });
});

describe("service Coach Deck", () => {
  it("attribue, sauvegarde, modifie et active les decks du joueur", async () => {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        displayName: "Coach test",
        player: {
          create: {
            firstName: "Alex",
            lastName: "Test",
            nationality: "FR",
            gender: "Homme",
            dominantHand: "Droite",
            backhand: "Deux mains",
            archetype: "Joueur complet",
            avatar: "avatar-01",
            stats: "{}",
            playerLevel: 8,
            overall: 50
          }
        }
      },
      include: { player: true }
    });
    const player = user.player!;
    const initial = await getCoachDeckState(player);

    expect(initial.catalog).toHaveLength(24);
    expect(initial.catalog.filter((card) => card.unlocked).length).toBeGreaterThan(12);
    expect(initial.decks).toHaveLength(1);
    expect(initial.decks[0]?.cardIds).toEqual(STARTER_COACH_DECK_CARD_IDS);
    expect(initial.decks[0]?.isActive).toBe(true);

    const created = await createCoachDeck({
      player,
      name: "Plan retour",
      cardIds: STARTER_COACH_DECK_CARD_IDS,
      activate: false
    });
    const second = created.decks.find((deck) => deck.name === "Plan retour");
    expect(second).toBeDefined();

    const updated = await updateCoachDeck({
      player,
      deckId: second!.id,
      name: "Plan retour agressif",
      cardIds: [...STARTER_COACH_DECK_CARD_IDS].reverse(),
      activate: false
    });
    expect(updated.decks.find((deck) => deck.id === second!.id)?.version).toBe(2);

    const activated = await activateCoachDeck(player, second!.id);
    expect(activated.activeDeckId).toBe(second!.id);
    expect(activated.decks.filter((deck) => deck.isActive)).toHaveLength(1);

    await prisma.playerCoachCard.update({
      where: { playerId_cardId: { playerId: player.id, cardId: "power-forehand" } },
      data: { masteryXp: 30, masteryLevel: 1 }
    });
    const variantState = await selectCoachCardVariant(player, "power-forehand", "IMPACT");
    expect(variantState.catalog.find((card) => card.id === "power-forehand")).toMatchObject({
      selectedVariant: "IMPACT",
      masteryLevel: 1,
      effectiveFocusCost: 3
    });

    const rewards = await prisma.$transaction((tx) =>
      awardCoachDeckMatchProgress(tx, {
        playerId: player.id,
        won: true,
        abandoned: false,
        history: [
          {
            cardId: "power-forehand",
            intentMatched: false,
            pointChanceDelta: 0.045
          },
          {
            cardId: "protect-backhand",
            intentMatched: true,
            pointChanceDelta: 0.052
          }
        ]
      })
    );
    expect(rewards.totalMasteryXp).toBeGreaterThan(0);
    expect(rewards.cards).toHaveLength(2);
    expect(
      rewards.cards.find((card) => card.cardId === "protect-backhand")?.xpGained
    ).toBeGreaterThan(
      rewards.cards.find((card) => card.cardId === "power-forehand")?.xpGained ?? 0
    );
  });

  it("répare automatiquement le deck vide d’un ancien compte", async () => {
    const user = await prisma.user.create({
      data: {
        email: legacyEmail,
        passwordHash: "test",
        displayName: "Ancien coach",
        player: {
          create: {
            firstName: "Camille",
            lastName: "Legacy",
            nationality: "FR",
            gender: "Femme",
            dominantHand: "Droite",
            backhand: "Deux mains",
            archetype: "Joueuse complète",
            avatar: "avatar-02",
            stats: "{}",
            playerLevel: 0,
            overall: 1,
            coachDecks: { create: { name: "Ancien deck vide", isActive: true } }
          }
        }
      },
      include: { player: true }
    });

    const repaired = await getCoachDeckState(user.player!);

    expect(repaired.decks).toHaveLength(1);
    expect(repaired.decks[0]?.isActive).toBe(true);
    expect(repaired.decks[0]?.cardIds).toEqual(STARTER_COACH_DECK_CARD_IDS);
    expect(repaired.catalog.filter((card) => card.unlocked).length).toBeGreaterThanOrEqual(12);
  });
});
