import type { Player } from "@prisma/client";
import { prisma } from "@mypro/database";
import {
  COACH_CARDS,
  COACH_DECK_FOCUS_PER_SET,
  COACH_DECK_HAND_SIZE,
  COACH_DECK_SIZE,
  STARTER_COACH_DECK_CARD_IDS,
  validateCoachDeck
} from "@mypro/match-engine-tennis";

const coachDeckInclude = {
  cards: { orderBy: { position: "asc" as const } }
};

export class CoachDeckError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

function unlockedCardIdsForLevel(playerLevel: number) {
  const cardIds = new Set<string>(STARTER_COACH_DECK_CARD_IDS);
  for (const card of COACH_CARDS) {
    if (card.unlockLevel <= playerLevel) cardIds.add(card.id);
  }
  return [...cardIds];
}

async function unlockEligibleCards(player: Player) {
  const cardIds = unlockedCardIdsForLevel(player.playerLevel);
  await prisma.$transaction(
    cardIds.map((cardId) =>
      prisma.playerCoachCard.upsert({
        where: { playerId_cardId: { playerId: player.id, cardId } },
        create: { playerId: player.id, cardId },
        update: {}
      })
    )
  );
}

async function ensureStarterDeck(player: Player) {
  const decks = await prisma.coachDeck.findMany({
    where: { playerId: player.id },
    include: coachDeckInclude,
    orderBy: { createdAt: "asc" }
  });

  if (decks.length === 0) {
    const created = await prisma.coachDeck.create({
      data: {
        playerId: player.id,
        name: "Deck équilibré",
        isActive: true,
        cards: {
          create: STARTER_COACH_DECK_CARD_IDS.map((cardId, position) => ({ cardId, position }))
        }
      }
    });
    return created.id;
  }

  const validDeckIds = new Set(
    decks
      .filter((deck) => validateCoachDeck(deck.cards.map((card) => card.cardId)).valid)
      .map((deck) => deck.id)
  );
  const selected =
    decks.find((deck) => deck.isActive && validDeckIds.has(deck.id)) ??
    decks.find((deck) => validDeckIds.has(deck.id)) ??
    decks.find((deck) => deck.isActive) ??
    decks[0]!;
  const activeDecks = decks.filter((deck) => deck.isActive);
  const invalidDecks = decks.filter((deck) => !validDeckIds.has(deck.id));

  if (invalidDecks.length > 0 || !selected.isActive || activeDecks.length !== 1) {
    await prisma.$transaction(async (tx) => {
      for (const deck of invalidDecks) {
        await tx.coachDeckCard.deleteMany({ where: { deckId: deck.id } });
        await tx.coachDeck.update({
          where: { id: deck.id },
          data: {
            version: { increment: 1 },
            cards: {
              create: STARTER_COACH_DECK_CARD_IDS.map((cardId, position) => ({ cardId, position }))
            }
          }
        });
      }
      await tx.coachDeck.updateMany({
        where: { playerId: player.id },
        data: { isActive: false }
      });
      await tx.coachDeck.update({ where: { id: selected.id }, data: { isActive: true } });
    });
  }

  return selected.id;
}

export async function ensureCoachDeckReady(player: Player) {
  await unlockEligibleCards(player);
  return ensureStarterDeck(player);
}

async function statePayload(player: Player) {
  const [ownedCards, decks] = await Promise.all([
    prisma.playerCoachCard.findMany({
      where: { playerId: player.id },
      orderBy: [{ masteryLevel: "desc" }, { unlockedAt: "asc" }]
    }),
    prisma.coachDeck.findMany({
      where: { playerId: player.id },
      include: coachDeckInclude,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
    })
  ]);
  const ownedById = new Map(ownedCards.map((card) => [card.cardId, card]));
  return {
    rules: {
      deckSize: COACH_DECK_SIZE,
      handSize: COACH_DECK_HAND_SIZE,
      focusPerSet: COACH_DECK_FOCUS_PER_SET,
      maxDecks: 5
    },
    activeDeckId: decks.find((deck) => deck.isActive)?.id ?? null,
    catalog: COACH_CARDS.map((card) => {
      const owned = ownedById.get(card.id);
      return {
        ...card,
        unlocked: Boolean(owned),
        masteryXp: owned?.masteryXp ?? 0,
        masteryLevel: owned?.masteryLevel ?? 0,
        selectedVariant: owned?.selectedVariant ?? null
      };
    }),
    decks: decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      isActive: deck.isActive,
      version: deck.version,
      cardIds: deck.cards.map((card) => card.cardId),
      updatedAt: deck.updatedAt.toISOString()
    }))
  };
}

export async function getCoachDeckState(player: Player) {
  await ensureCoachDeckReady(player);
  return statePayload(player);
}

export async function getCoachDeckSnapshot(player: Player, requestedDeckId?: string) {
  await ensureCoachDeckReady(player);
  const deck = await prisma.coachDeck.findFirst({
    where: {
      playerId: player.id,
      ...(requestedDeckId ? { id: requestedDeckId } : { isActive: true })
    },
    include: coachDeckInclude
  });
  if (!deck) throw new CoachDeckError("Deck Coach actif introuvable.", 404);
  const cardIds = deck.cards.map((card) => card.cardId);
  await validateOwnedDeck(player, cardIds);
  return { id: deck.id, name: deck.name, version: deck.version, cardIds };
}

async function validateOwnedDeck(player: Player, cardIds: readonly string[]) {
  await unlockEligibleCards(player);
  const owned = await prisma.playerCoachCard.findMany({
    where: { playerId: player.id },
    select: { cardId: true }
  });
  const validation = validateCoachDeck(cardIds, {
    playerLevel: player.playerLevel,
    unlockedCardIds: owned.map((card) => card.cardId)
  });
  if (!validation.valid) throw new CoachDeckError(validation.errors[0] ?? "Deck invalide.", 400);
  return validation;
}

export async function createCoachDeck(input: {
  player: Player;
  name: string;
  cardIds: readonly string[];
  activate: boolean;
}) {
  await ensureStarterDeck(input.player);
  await validateOwnedDeck(input.player, input.cardIds);
  const count = await prisma.coachDeck.count({ where: { playerId: input.player.id } });
  if (count >= 5) throw new CoachDeckError("Vous pouvez enregistrer jusqu’à 5 decks.", 409);
  await prisma.$transaction(async (tx) => {
    if (input.activate) {
      await tx.coachDeck.updateMany({
        where: { playerId: input.player.id },
        data: { isActive: false }
      });
    }
    await tx.coachDeck.create({
      data: {
        playerId: input.player.id,
        name: input.name,
        isActive: input.activate,
        cards: {
          create: input.cardIds.map((cardId, position) => ({ cardId, position }))
        }
      }
    });
  });
  return statePayload(input.player);
}

export async function updateCoachDeck(input: {
  player: Player;
  deckId: string;
  name: string;
  cardIds: readonly string[];
  activate: boolean;
}) {
  await validateOwnedDeck(input.player, input.cardIds);
  const deck = await prisma.coachDeck.findFirst({
    where: { id: input.deckId, playerId: input.player.id }
  });
  if (!deck) throw new CoachDeckError("Deck introuvable.", 404);
  await prisma.$transaction(async (tx) => {
    if (input.activate) {
      await tx.coachDeck.updateMany({
        where: { playerId: input.player.id },
        data: { isActive: false }
      });
    }
    await tx.coachDeckCard.deleteMany({ where: { deckId: deck.id } });
    await tx.coachDeck.update({
      where: { id: deck.id },
      data: {
        name: input.name,
        isActive: input.activate || deck.isActive,
        version: { increment: 1 },
        cards: {
          create: input.cardIds.map((cardId, position) => ({ cardId, position }))
        }
      }
    });
  });
  return statePayload(input.player);
}

export async function activateCoachDeck(player: Player, deckId: string) {
  const deck = await prisma.coachDeck.findFirst({ where: { id: deckId, playerId: player.id } });
  if (!deck) throw new CoachDeckError("Deck introuvable.", 404);
  await prisma.$transaction([
    prisma.coachDeck.updateMany({
      where: { playerId: player.id },
      data: { isActive: false }
    }),
    prisma.coachDeck.update({ where: { id: deck.id }, data: { isActive: true } })
  ]);
  return statePayload(player);
}
