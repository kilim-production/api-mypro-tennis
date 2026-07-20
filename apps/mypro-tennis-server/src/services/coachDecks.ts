import type { Player, PlayerCoachCard, Prisma } from "@prisma/client";
import { prisma } from "@mypro/database";
import {
  COACH_CARD_MASTERY_VARIANTS,
  COACH_CARDS,
  COACH_DECK_FOCUS_PER_SET,
  COACH_DECK_HAND_SIZE,
  COACH_DECK_SIZE,
  STARTER_COACH_DECK_CARD_IDS,
  coachCardFocusCost,
  coachCardMasteryLevelForXp,
  coachCardMasteryProgress,
  coachCardMasteryVariant,
  coachCardVariantUnlocked,
  validateCoachDeck
} from "@mypro/match-engine-tennis";

const coachDeckInclude = {
  cards: { orderBy: { position: "asc" as const } }
};

type CoachDeckWithCards = Prisma.CoachDeckGetPayload<{ include: { cards: true } }>;

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
  const ownedCards = await prisma.playerCoachCard.findMany({
    where: { playerId: player.id, cardId: { in: cardIds } },
    select: { cardId: true }
  });
  const ownedCardIds = new Set(ownedCards.map((card) => card.cardId));
  const missingCardIds = cardIds.filter((cardId) => !ownedCardIds.has(cardId));
  if (missingCardIds.length === 0) return;

  await prisma.$transaction(
    missingCardIds.map((cardId) =>
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

function buildStatePayload(ownedCards: PlayerCoachCard[], decks: CoachDeckWithCards[]) {
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
      const mastery = coachCardMasteryProgress(owned?.masteryXp ?? 0);
      const selectedVariant = coachCardVariantUnlocked(owned?.selectedVariant, mastery.level)
        ? (coachCardMasteryVariant(owned?.selectedVariant)?.id ?? null)
        : null;
      return {
        ...card,
        unlocked: Boolean(owned),
        masteryXp: owned?.masteryXp ?? 0,
        masteryLevel: mastery.level,
        mastery,
        selectedVariant,
        effectiveFocusCost: coachCardFocusCost(card, selectedVariant),
        variants: COACH_CARD_MASTERY_VARIANTS.map((variant) => ({
          ...variant,
          unlocked: mastery.level >= variant.unlockMasteryLevel,
          selected: selectedVariant === variant.id
        }))
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
  return buildStatePayload(ownedCards, decks);
}

export async function getCoachDeckState(player: Player) {
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
  const eligibleCardIds = unlockedCardIdsForLevel(player.playerLevel);
  const ownedCardIds = new Set(ownedCards.map((card) => card.cardId));
  const validDecks = decks.filter((deck) =>
    validateCoachDeck(deck.cards.map((card) => card.cardId)).valid
  );
  const activeDecks = decks.filter((deck) => deck.isActive);
  const selectedDeck =
    validDecks.find((deck) => deck.isActive) ?? validDecks[0] ?? activeDecks[0] ?? decks[0];
  const needsRepair =
    eligibleCardIds.some((cardId) => !ownedCardIds.has(cardId)) ||
    decks.length === 0 ||
    validDecks.length !== decks.length ||
    !selectedDeck?.isActive ||
    activeDecks.length !== 1;

  if (needsRepair) {
    await ensureCoachDeckReady(player);
    return statePayload(player);
  }
  return buildStatePayload(ownedCards, decks);
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
  const ownedCards = await validateOwnedDeck(player, cardIds);
  const ownedById = new Map(ownedCards.map((card) => [card.cardId, card]));
  const cardVariants = Object.fromEntries(
    [...new Set(cardIds)].map((cardId) => {
      const owned = ownedById.get(cardId);
      const level = coachCardMasteryLevelForXp(owned?.masteryXp ?? 0);
      const variant = coachCardVariantUnlocked(owned?.selectedVariant, level)
        ? coachCardMasteryVariant(owned?.selectedVariant)?.id
        : undefined;
      return [cardId, variant ?? null];
    })
  );
  return { id: deck.id, name: deck.name, version: deck.version, cardIds, cardVariants };
}

async function validateOwnedDeck(player: Player, cardIds: readonly string[]) {
  await unlockEligibleCards(player);
  const owned = await prisma.playerCoachCard.findMany({
    where: { playerId: player.id }
  });
  const validation = validateCoachDeck(cardIds, {
    playerLevel: player.playerLevel,
    unlockedCardIds: owned.map((card) => card.cardId)
  });
  if (!validation.valid) throw new CoachDeckError(validation.errors[0] ?? "Deck invalide.", 400);
  return owned;
}

export async function selectCoachCardVariant(
  player: Player,
  cardId: string,
  variantId: string | null
) {
  const card = COACH_CARDS.find((candidate) => candidate.id === cardId);
  if (!card) throw new CoachDeckError("Carte Coach inconnue.", 404);
  await unlockEligibleCards(player);
  const owned = await prisma.playerCoachCard.findUnique({
    where: { playerId_cardId: { playerId: player.id, cardId } }
  });
  if (!owned) throw new CoachDeckError("Cette carte n’est pas encore débloquée.", 403);
  const level = coachCardMasteryLevelForXp(owned.masteryXp);
  if (!coachCardVariantUnlocked(variantId, level)) {
    throw new CoachDeckError("Cette variante demande davantage de maîtrise.", 403);
  }
  const selectedVariant = variantId === null ? null : coachCardMasteryVariant(variantId)?.id;
  if (variantId !== null && !selectedVariant) {
    throw new CoachDeckError("Variante Coach inconnue.", 400);
  }
  await prisma.playerCoachCard.update({
    where: { id: owned.id },
    data: { selectedVariant: selectedVariant ?? null }
  });
  return statePayload(player);
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

export type CoachDeckMatchRewards = {
  totalMasteryXp: number;
  won: boolean;
  abandoned: boolean;
  cards: Array<{
    cardId: string;
    name: string;
    plays: number;
    intentMatches: number;
    xpGained: number;
    xpBefore: number;
    xpAfter: number;
    levelBefore: number;
    levelAfter: number;
    nextLevelXp: number | null;
    progress: number;
    unlockedVariants: Array<{ id: string; name: string; description: string }>;
  }>;
  unlockedCards: Array<{
    cardId: string;
    name: string;
    family: string;
    unlockLevel: number;
  }>;
};

export async function awardCoachDeckMatchProgress(
  tx: Prisma.TransactionClient,
  input: {
    playerId: string;
    won: boolean;
    abandoned: boolean;
    history: ReadonlyArray<{
      cardId: string | null;
      intentMatched: boolean;
      pointChanceDelta: number;
    }>;
  }
): Promise<CoachDeckMatchRewards> {
  const empty: CoachDeckMatchRewards = {
    totalMasteryXp: 0,
    won: input.won,
    abandoned: input.abandoned,
    cards: [],
    unlockedCards: []
  };
  if (input.abandoned) return empty;

  const usage = new Map<string, { plays: number; intentMatches: number; impact: number }>();
  for (const entry of input.history) {
    if (!entry.cardId) continue;
    const current = usage.get(entry.cardId) ?? { plays: 0, intentMatches: 0, impact: 0 };
    current.plays += 1;
    current.intentMatches += entry.intentMatched ? 1 : 0;
    current.impact += Math.abs(entry.pointChanceDelta);
    usage.set(entry.cardId, current);
  }

  const ownedBefore = await tx.playerCoachCard.findMany({ where: { playerId: input.playerId } });
  const ownedById = new Map(ownedBefore.map((card) => [card.cardId, card]));
  const cardRewards: CoachDeckMatchRewards["cards"] = [];

  for (const [cardId, stats] of usage) {
    const definition = COACH_CARDS.find((card) => card.id === cardId);
    if (!definition) continue;
    const owned = ownedById.get(cardId);
    const xpBefore = owned?.masteryXp ?? 0;
    const levelBefore = coachCardMasteryLevelForXp(xpBefore);
    const impactBonus = Math.min(12, Math.round(stats.impact * 100));
    const rewardedPlays = Math.min(5, stats.plays);
    const rewardedCounters = Math.min(rewardedPlays, stats.intentMatches);
    const xpGained =
      rewardedPlays * 14 + rewardedCounters * 6 + impactBonus + 4 + (input.won ? 4 : 2);
    const xpAfter = xpBefore + xpGained;
    const masteryAfter = coachCardMasteryProgress(xpAfter);
    await tx.playerCoachCard.upsert({
      where: { playerId_cardId: { playerId: input.playerId, cardId } },
      create: {
        playerId: input.playerId,
        cardId,
        masteryXp: xpAfter,
        masteryLevel: masteryAfter.level
      },
      update: {
        masteryXp: xpAfter,
        masteryLevel: masteryAfter.level
      }
    });
    cardRewards.push({
      cardId,
      name: definition.name,
      plays: stats.plays,
      intentMatches: stats.intentMatches,
      xpGained,
      xpBefore,
      xpAfter,
      levelBefore,
      levelAfter: masteryAfter.level,
      nextLevelXp: masteryAfter.nextLevelXp,
      progress: masteryAfter.progress,
      unlockedVariants: COACH_CARD_MASTERY_VARIANTS.filter(
        (variant) =>
          variant.unlockMasteryLevel > levelBefore &&
          variant.unlockMasteryLevel <= masteryAfter.level
      ).map((variant) => ({
        id: variant.id,
        name: variant.name,
        description: variant.description
      }))
    });
  }

  const player = await tx.player.findUniqueOrThrow({ where: { id: input.playerId } });
  const ownedAfterMastery = new Set(
    (
      await tx.playerCoachCard.findMany({
        where: { playerId: input.playerId },
        select: { cardId: true }
      })
    ).map((card) => card.cardId)
  );
  const newlyUnlockedDefinitions = COACH_CARDS.filter(
    (card) => card.unlockLevel <= player.playerLevel && !ownedAfterMastery.has(card.id)
  );
  for (const card of newlyUnlockedDefinitions) {
    await tx.playerCoachCard.create({ data: { playerId: input.playerId, cardId: card.id } });
  }

  cardRewards.sort(
    (left, right) => right.xpGained - left.xpGained || left.name.localeCompare(right.name)
  );
  return {
    totalMasteryXp: cardRewards.reduce((total, reward) => total + reward.xpGained, 0),
    won: input.won,
    abandoned: false,
    cards: cardRewards,
    unlockedCards: newlyUnlockedDefinitions.map((card) => ({
      cardId: card.id,
      name: card.name,
      family: card.family,
      unlockLevel: card.unlockLevel
    }))
  };
}
