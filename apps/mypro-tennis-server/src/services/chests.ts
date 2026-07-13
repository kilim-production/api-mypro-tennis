import type { Player, Prisma, TennisBagChest } from "@prisma/client";
import { prisma } from "@mypro/database";
import {
  calculateOverall,
  clamp,
  trainingCardLevelForCopies,
  trainingCardProgress,
  trainingCardUnlockCost
} from "@mypro/core";
import type { TennisStats } from "@mypro/sports-tennis";
import { decodeJson, encodeJson } from "./json";
import { cosmeticPublicPayload, generateCosmeticBonuses } from "./equipment";

export type ChestRarity = "Bronze" | "Argent" | "Or" | "Légendaire" | "Mythique";

type ChestDefinition = {
  rarity: ChestRarity;
  durationMinutes: number;
  cardPicks: number;
  money: [number, number];
  gemChance: number;
  gems: [number, number];
  cosmeticChance: number;
};

type ChestRewardCard = {
  statKey: string;
  label: string;
  copies: number;
  totalCopies: number;
  levelBefore: number;
  levelAfter: number;
  bonus: number;
  nextRequired: number;
};

export type ChestRewards = {
  cards: ChestRewardCard[];
  money: number;
  gems: number;
  cosmetics: Array<{
    id: string;
    name: string;
    rarity: ChestRarity;
    bonuses: Partial<TennisStats>;
  }>;
  statBonuses: Record<string, number>;
};

const chestDefinitions: Record<ChestRarity, ChestDefinition> = {
  Bronze: {
    rarity: "Bronze",
    durationMinutes: 0,
    cardPicks: 2,
    money: [90, 170],
    gemChance: 0.04,
    gems: [1, 1],
    cosmeticChance: 0.02
  },
  Argent: {
    rarity: "Argent",
    durationMinutes: 10,
    cardPicks: 4,
    money: [240, 420],
    gemChance: 0.08,
    gems: [1, 2],
    cosmeticChance: 0.05
  },
  Or: {
    rarity: "Or",
    durationMinutes: 30,
    cardPicks: 7,
    money: [680, 1050],
    gemChance: 0.16,
    gems: [2, 4],
    cosmeticChance: 0.1
  },
  Légendaire: {
    rarity: "Légendaire",
    durationMinutes: 180,
    cardPicks: 12,
    money: [1500, 2300],
    gemChance: 0.38,
    gems: [4, 8],
    cosmeticChance: 0.28
  },
  Mythique: {
    rarity: "Mythique",
    durationMinutes: 720,
    cardPicks: 20,
    money: [3600, 5400],
    gemChance: 0.72,
    gems: [8, 15],
    cosmeticChance: 0.65
  }
};

export const collectibleStatCards = [
  { key: "service", label: "Service" },
  { key: "return", label: "Retour" },
  { key: "forehand", label: "Coup droit" },
  { key: "backhand", label: "Revers" },
  { key: "volley", label: "Volée" },
  { key: "smash", label: "Smash" },
  { key: "dropShot", label: "Amortie" },
  { key: "stamina", label: "Endurance" },
  { key: "speed", label: "Vitesse" },
  { key: "explosiveness", label: "Explosivité" },
  { key: "strength", label: "Force" },
  { key: "recovery", label: "Récupération" }
] as const;

const cosmetics = [
  "Poignets Émeraude",
  "Casquette Académie",
  "Surgrip Noir Premium",
  "Sac Signature MYPRO",
  "T-shirt Circuit Junior",
  "Bandeau Nuit Centrale"
];

function raritySlug(rarity: ChestRarity) {
  return rarity
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const victoryChestOdds: Array<{ rarity: ChestRarity; weight: number }> = [
  { rarity: "Bronze", weight: 60 },
  { rarity: "Argent", weight: 25 },
  { rarity: "Or", weight: 10 },
  { rarity: "Légendaire", weight: 4 },
  { rarity: "Mythique", weight: 1 }
];
const trainingCenterRareChestBonuses: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 4,
  4: 6,
  5: 8
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function pickInt(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

function adjustedVictoryChestOdds(rareChestBonusPercent: number) {
  const bonus = Math.max(0, Math.min(8, rareChestBonusPercent));
  if (bonus <= 0) return victoryChestOdds;
  const nonBronzeWeight = victoryChestOdds
    .filter((item) => item.rarity !== "Bronze")
    .reduce((sum, item) => sum + item.weight, 0);
  return victoryChestOdds.map((item) => {
    if (item.rarity === "Bronze") return { ...item, weight: Math.max(1, item.weight - bonus) };
    return { ...item, weight: item.weight + bonus * (item.weight / nonBronzeWeight) };
  });
}

async function rareChestBonusForPlayer(playerId: string, tx: Prisma.TransactionClient) {
  const membership = await tx.clubMembership.findUnique({
    where: { playerId },
    include: { club: { select: { trainingCenterLevel: true } } }
  });
  const level = membership?.club.trainingCenterLevel ?? 0;
  return trainingCenterRareChestBonuses[Math.max(0, Math.min(5, level))] ?? 0;
}

function rollRarity(random: () => number, rareChestBonusPercent = 0): ChestRarity {
  const odds = adjustedVictoryChestOdds(rareChestBonusPercent);
  const totalWeight = odds.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * totalWeight;
  for (const item of odds) {
    roll -= item.weight;
    if (roll < 0) return item.rarity;
  }
  return "Bronze";
}

function summarizeChest(chest: TennisBagChest, now = new Date()) {
  const definition = chestDefinitions[chest.rarity as ChestRarity] ?? chestDefinitions.Bronze;
  const remainingMs = Math.max(0, chest.unlocksAt.getTime() - now.getTime());
  return {
    ...chest,
    rewards: decodeJson(chest.rewards),
    durationMinutes: definition.durationMinutes,
    canOpen: !chest.openedAt && remainingMs === 0,
    remainingMs,
    speedUpCost: Math.max(1, Math.ceil(remainingMs / (10 * 60_000)))
  };
}

export function chestPublicCatalog() {
  return Object.values(chestDefinitions).map((definition) => ({
    rarity: definition.rarity,
    durationMinutes: definition.durationMinutes,
    cardPicks: definition.cardPicks,
    victoryDropRate: victoryChestOdds.find((item) => item.rarity === definition.rarity)?.weight ?? 0
  }));
}

export async function getChestState(playerId: string) {
  const [chests, cards, cosmeticsOwned, player] = await Promise.all([
    prisma.tennisBagChest.findMany({
      where: { playerId, openedAt: null },
      orderBy: { slotIndex: "asc" }
    }),
    prisma.playerStatCard.findMany({ where: { playerId }, orderBy: { statKey: "asc" } }),
    prisma.playerCosmetic.findMany({ where: { playerId }, orderBy: { ownedAt: "desc" } }),
    prisma.player.findUnique({ where: { id: playerId } })
  ]);
  const slots = Array.from({ length: 4 }, (_, slotIndex) => ({
    slotIndex,
    chest: chests.find((chest) => chest.slotIndex === slotIndex)
      ? summarizeChest(chests.find((chest) => chest.slotIndex === slotIndex)!)
      : null
  }));
  return {
    slots,
    cards: collectibleStatCards.map((definition) => {
      const card = cards.find((item) => item.statKey === definition.key);
      const progress = trainingCardProgress(card?.copies ?? 0);
      const unlockedLevel = card?.level ?? 0;
      const nextUnlockLevel = unlockedLevel + 1;
      return {
        statKey: definition.key,
        label: definition.label,
        ...progress,
        earnedLevel: progress.level,
        level: unlockedLevel,
        unlockable: progress.level >= nextUnlockLevel,
        unlockCost: trainingCardUnlockCost(nextUnlockLevel)
      };
    }),
    cosmetics: cosmeticsOwned.map(cosmeticPublicPayload),
    gems: player?.gems ?? 0
  };
}

export async function awardChestForWin(
  player: Pick<Player, "id" | "isAi">,
  tx: Prisma.TransactionClient,
  source: string,
  forcedRarity?: ChestRarity
) {
  if (player.isAi) return null;
  const active = await tx.tennisBagChest.findMany({
    where: { playerId: player.id, openedAt: null },
    select: { slotIndex: true }
  });
  if (active.length >= 4) return null;
  const used = new Set(active.map((chest) => chest.slotIndex));
  const slotIndex = [0, 1, 2, 3].find((slot) => !used.has(slot));
  if (slotIndex === undefined) return null;
  const random = randomFromSeed(`${player.id}-${source}-${Date.now()}-${slotIndex}`);
  const rareChestBonus = forcedRarity ? 0 : await rareChestBonusForPlayer(player.id, tx);
  const rarity = forcedRarity ?? rollRarity(random, rareChestBonus);
  const definition = chestDefinitions[rarity];
  const now = new Date();
  const unlocksAt = new Date(now.getTime() + definition.durationMinutes * 60_000);
  return tx.tennisBagChest.create({
    data: {
      playerId: player.id,
      rarity,
      slotIndex,
      source,
      status: definition.durationMinutes === 0 ? "READY" : "LOCKED",
      unlockStartedAt: now,
      unlocksAt
    }
  });
}

function rollRewards(
  chest: Pick<TennisBagChest, "id" | "playerId" | "rarity" | "createdAt">
): ChestRewards {
  const definition = chestDefinitions[chest.rarity as ChestRarity] ?? chestDefinitions.Bronze;
  const random = randomFromSeed(
    `${chest.id}-${chest.playerId}-${chest.createdAt.toISOString()}-open`
  );
  const cards = new Map<string, number>();
  for (let index = 0; index < definition.cardPicks; index += 1) {
    const card =
      collectibleStatCards[pickInt(random, 0, collectibleStatCards.length - 1)] ??
      collectibleStatCards[0];
    cards.set(
      card.key,
      (cards.get(card.key) ?? 0) + (chest.rarity === "Mythique" ? pickInt(random, 2, 4) : 1)
    );
  }
  const cosmeticReward =
    random() < definition.cosmeticChance
      ? (() => {
          const cosmeticIndex = pickInt(random, 0, cosmetics.length - 1);
          const variant = pickInt(random, 1, 999);
          const id = `${raritySlug(definition.rarity)}-${cosmeticIndex}-${variant}`;
          return {
            id,
            name: cosmetics[cosmeticIndex] ?? "Style MYPRO",
            rarity: definition.rarity,
            bonuses: generateCosmeticBonuses(id, definition.rarity)
          };
        })()
      : null;
  const reward: ChestRewards = {
    cards: [...cards].map(([statKey, copies]) => {
      const label = collectibleStatCards.find((card) => card.key === statKey)?.label ?? statKey;
      return {
        statKey,
        label,
        copies,
        totalCopies: copies,
        levelBefore: 0,
        levelAfter: 0,
        bonus: 0,
        nextRequired: 0
      };
    }),
    money: pickInt(random, definition.money[0], definition.money[1]),
    gems:
      random() < definition.gemChance ? pickInt(random, definition.gems[0], definition.gems[1]) : 0,
    cosmetics: cosmeticReward ? [cosmeticReward] : [],
    statBonuses: {}
  };
  return reward;
}

export async function openChest(playerId: string, chestId: string) {
  return prisma.$transaction(async (tx) => {
    const chest = await tx.tennisBagChest.findFirst({
      where: { id: chestId, playerId, openedAt: null }
    });
    if (!chest) throw new Error("Sac introuvable.");
    if (chest.unlocksAt.getTime() > Date.now()) throw new Error("Ce sac n'est pas encore prêt.");
    const rewards = rollRewards(chest);

    await grantChestRewards(tx, playerId, rewards);
    const opened = await tx.tennisBagChest.update({
      where: { id: chest.id },
      data: { status: "OPENED", openedAt: new Date(), rewards: encodeJson(rewards) }
    });
    return { chest: summarizeChest(opened), rewards };
  });
}

export async function grantChestRewards(
  tx: Prisma.TransactionClient,
  playerId: string,
  rewards: ChestRewards
) {
  for (const rewardCard of rewards.cards) {
    const existing = await tx.playerStatCard.findUnique({
      where: { playerId_statKey: { playerId, statKey: rewardCard.statKey } }
    });
    const beforeCopies = existing?.copies ?? 0;
    const beforeLevel = existing?.level ?? 0;
    const beforeEarnedLevel = trainingCardLevelForCopies(beforeCopies);
    const totalCopies = beforeCopies + rewardCard.copies;
    const afterLevel = trainingCardLevelForCopies(totalCopies);
    const bonus = Math.max(0, afterLevel - Math.max(beforeLevel, beforeEarnedLevel));
    const progress = trainingCardProgress(totalCopies);
    rewardCard.totalCopies = totalCopies;
    rewardCard.levelBefore = beforeLevel;
    rewardCard.levelAfter = afterLevel;
    rewardCard.bonus = bonus;
    rewardCard.nextRequired = progress.nextFloor;
    await tx.playerStatCard.upsert({
      where: { playerId_statKey: { playerId, statKey: rewardCard.statKey } },
      update: { copies: totalCopies },
      create: { playerId, statKey: rewardCard.statKey, copies: totalCopies, level: 0 }
    });
  }

  for (const cosmetic of rewards.cosmetics) {
    await tx.playerCosmetic.upsert({
      where: { playerId_cosmeticId: { playerId, cosmeticId: cosmetic.id } },
      update: {
        name: cosmetic.name,
        rarity: cosmetic.rarity,
        bonuses: encodeJson(cosmetic.bonuses)
      },
      create: {
        playerId,
        cosmeticId: cosmetic.id,
        name: cosmetic.name,
        rarity: cosmetic.rarity,
        bonuses: encodeJson(cosmetic.bonuses)
      }
    });
  }

  const readyCards = rewards.cards.filter((card) => card.bonus > 0);
  const playerOwner = readyCards.length
    ? await tx.player.findUnique({ where: { id: playerId }, select: { userId: true } })
    : null;
  if (playerOwner?.userId && readyCards.length) {
    const cardList = readyCards.map((card) => `${card.label} +${card.bonus}`).join(", ");
    await tx.notification.create({
      data: {
        userId: playerOwner.userId,
        title: "Palier de carte atteint",
        body: `${cardList} prêt à débloquer dans votre collection.`,
        type: "COLLECTION"
      }
    });
  }

  await tx.player.update({
    where: { id: playerId },
    data: {
      budget: { increment: rewards.money },
      gems: { increment: rewards.gems }
    }
  });
}

export async function openInstantChestReward(
  tx: Prisma.TransactionClient,
  playerId: string,
  rarity: ChestRarity,
  source: string
) {
  const rewards = rollRewards({
    id: `instant-${source}`,
    playerId,
    rarity,
    createdAt: new Date()
  });
  await grantChestRewards(tx, playerId, rewards);
  return rewards;
}

export async function unlockStatCardBonus(playerId: string, statKey: string) {
  const definition = collectibleStatCards.find((card) => card.key === statKey);
  if (!definition) throw new Error("Carte statistique inconnue.");

  return prisma.$transaction(async (tx) => {
    const [player, card] = await Promise.all([
      tx.player.findUniqueOrThrow({ where: { id: playerId } }),
      tx.playerStatCard.findUnique({ where: { playerId_statKey: { playerId, statKey } } })
    ]);
    if (!card) throw new Error("Carte statistique introuvable.");

    const nextLevel = card.level + 1;
    const earnedLevel = trainingCardLevelForCopies(card.copies);
    if (earnedLevel < nextLevel) throw new Error("Palier de doublons non atteint.");

    const cost = trainingCardUnlockCost(nextLevel);
    if (player.budget < cost) throw new Error(`Crédits insuffisants. Coût : ${cost} CR.`);

    const stats = { ...decodeJson<TennisStats>(player.stats) };
    stats[statKey as keyof TennisStats] = clamp((stats[statKey as keyof TennisStats] ?? 0) + 1);

    await tx.playerStatCard.update({
      where: { playerId_statKey: { playerId, statKey } },
      data: { level: nextLevel }
    });
    await tx.player.update({
      where: { id: playerId },
      data: {
        budget: { decrement: cost },
        stats: encodeJson(stats),
        overall: calculateOverall(stats)
      }
    });

    return { statKey, level: nextLevel, cost };
  });
}

export async function speedUpChest(playerId: string, chestId: string) {
  return prisma.$transaction(async (tx) => {
    const chest = await tx.tennisBagChest.findFirst({
      where: { id: chestId, playerId, openedAt: null }
    });
    if (!chest) throw new Error("Sac introuvable.");
    const remainingMs = chest.unlocksAt.getTime() - Date.now();
    if (remainingMs <= 0) return summarizeChest(chest);
    const cost = Math.max(1, Math.ceil(remainingMs / (10 * 60_000)));
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    if (player.gems < cost) throw new Error("Gemmes insuffisantes.");
    await tx.player.update({ where: { id: playerId }, data: { gems: { decrement: cost } } });
    const now = new Date();
    const updated = await tx.tennisBagChest.update({
      where: { id: chest.id },
      data: { status: "READY", unlocksAt: now }
    });
    return summarizeChest(updated);
  });
}
