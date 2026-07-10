import type { PlayerCosmetic, Prisma } from "@prisma/client";
import { calculateOverall, clamp } from "@mypro/core";
import { prisma } from "@mypro/database";
import type { TennisStats } from "@mypro/sports-tennis";
import { decodeJson, encodeJson } from "./json";

const equipmentStatKeys = [
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
  "recovery"
] as const;

const cosmeticNames = [
  "Poignets Émeraude",
  "Casquette Académie",
  "Surgrip Noir Premium",
  "Sac Signature MYPRO",
  "T-shirt Circuit Junior",
  "Bandeau Nuit Centrale"
];

const marketRecipes: Record<
  string,
  { required: number; resultRarity?: string; money?: number; label: string }
> = {
  Bronze: { required: 3, resultRarity: "Argent", label: "3 Bronze = 1 Argent" },
  Argent: { required: 6, resultRarity: "Or", label: "6 Argent = 1 Or" },
  Or: { required: 9, resultRarity: "Légendaire", label: "9 Or = 1 Légendaire" },
  Légendaire: { required: 12, resultRarity: "Mythique", label: "12 Légendaires = 1 Mythique" },
  Mythique: { required: 1, money: 10_000, label: "1 Mythique = 10 000 €" }
};

type CosmeticBonusSource = Pick<PlayerCosmetic, "bonuses" | "cosmeticId" | "rarity"> & {
  upgradeLevel?: number;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededPick(seed: string, index: number, max: number) {
  const value = Math.imul(hashSeed(`${seed}-${index}`), 2654435761) >>> 0;
  return value % max;
}

export function cosmeticBonusPoints(rarity: string) {
  const key = rarity
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (key.includes("mythique")) return 5;
  if (key.includes("legendaire") || key.includes("gendaire")) return 4;
  if (key === "or") return 3;
  if (key === "argent") return 2;
  return 1;
}

export function cosmeticUpgradeBaseCost(rarity: string) {
  const key = rarity
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (key.includes("mythique")) return 5000;
  if (key.includes("legendaire") || key.includes("gendaire")) return 4000;
  if (key === "or") return 3000;
  if (key === "argent") return 2000;
  return 1000;
}

export function cosmeticUpgradeCost(rarity: string, levelToUnlock: number) {
  return cosmeticUpgradeBaseCost(rarity) * Math.max(1, Math.min(3, levelToUnlock));
}

export function cosmeticUpgradeInvestment(rarity: string, upgradeLevel: number) {
  const safeLevel = Math.max(0, Math.min(3, Math.floor(upgradeLevel)));
  let total = 0;
  for (let level = 1; level <= safeLevel; level += 1) {
    total += cosmeticUpgradeCost(rarity, level);
  }
  return total;
}

export function cosmeticMarketRefundForItems(items: Array<Pick<PlayerCosmetic, "rarity" | "upgradeLevel">>) {
  const invested = items.reduce(
    (sum, item) => sum + cosmeticUpgradeInvestment(item.rarity, item.upgradeLevel),
    0
  );
  return Math.round(invested * 0.3);
}

export function generateCosmeticBonuses(cosmeticId: string, rarity: string) {
  const points = cosmeticBonusPoints(rarity);
  const bonuses: Partial<TennisStats> = {};
  const used = new Set<number>();

  for (let point = 0; point < points; point += 1) {
    let statIndex = seededPick(cosmeticId, point, equipmentStatKeys.length);
    while (used.has(statIndex)) {
      statIndex = (statIndex + 1) % equipmentStatKeys.length;
    }
    used.add(statIndex);
    const statKey = equipmentStatKeys[statIndex];
    if (statKey) bonuses[statKey] = (bonuses[statKey] ?? 0) + 1;
  }

  return bonuses;
}

function pickCosmeticName(seed: string) {
  return cosmeticNames[seededPick(seed, 0, cosmeticNames.length)] ?? "Style MYPRO";
}

function effectiveCosmeticBonuses(cosmetic: CosmeticBonusSource) {
  const stored = decodeJson<Partial<TennisStats>>(cosmetic.bonuses);
  const baseBonuses = Object.keys(stored).length
    ? stored
    : generateCosmeticBonuses(cosmetic.cosmeticId, cosmetic.rarity);
  const upgradeLevel = Math.max(0, Math.min(3, cosmetic.upgradeLevel ?? 0));
  return Object.fromEntries(
    Object.entries(baseBonuses).map(([key, value]) => [key, (value ?? 0) + upgradeLevel])
  ) as Partial<TennisStats>;
}

export function cosmeticPublicPayload(cosmetic: PlayerCosmetic & { upgradeLevel?: number }) {
  const upgradeLevel = Math.max(0, Math.min(3, cosmetic.upgradeLevel ?? 0));
  return {
    id: cosmetic.id,
    cosmeticId: cosmetic.cosmeticId,
    name: cosmetic.name,
    rarity: cosmetic.rarity,
    bonuses: effectiveCosmeticBonuses(cosmetic),
    upgradeLevel,
    nextUpgradeCost: upgradeLevel < 3 ? cosmeticUpgradeCost(cosmetic.rarity, upgradeLevel + 1) : null,
    canUpgrade: upgradeLevel < 3,
    equippedSlot: cosmetic.equippedSlot,
    ownedAt: cosmetic.ownedAt
  };
}

function sumBonuses(cosmetics: CosmeticBonusSource[]) {
  const total: Partial<TennisStats> = {};
  for (const cosmetic of cosmetics) {
    const bonuses = effectiveCosmeticBonuses(cosmetic);
    for (const [key, value] of Object.entries(bonuses)) {
      total[key as keyof TennisStats] = (total[key as keyof TennisStats] ?? 0) + (value ?? 0);
    }
  }
  return total;
}

function applyBonusDelta(
  stats: TennisStats,
  before: Partial<TennisStats>,
  after: Partial<TennisStats>
) {
  const next = { ...stats };
  for (const statKey of equipmentStatKeys) {
    const delta = (after[statKey] ?? 0) - (before[statKey] ?? 0);
    if (delta !== 0) next[statKey] = clamp((next[statKey] ?? 0) + delta);
  }
  return next;
}

async function updatePlayerStatsForEquipment(
  tx: Prisma.TransactionClient,
  playerId: string,
  before: Partial<TennisStats>
) {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const equipped = await tx.playerCosmetic.findMany({
    where: { playerId, equippedSlot: { not: null } }
  });
  const after = sumBonuses(equipped);
  const stats = applyBonusDelta(decodeJson<TennisStats>(player.stats), before, after);
  await tx.player.update({
    where: { id: playerId },
    data: {
      stats: encodeJson(stats),
      overall: calculateOverall(stats)
    }
  });
}

export async function equipCosmetic(playerId: string, cosmeticId: string, slotIndex: number) {
  if (slotIndex < 0 || slotIndex > 3) throw new Error("Emplacement invalide.");

  return prisma.$transaction(async (tx) => {
    const owned = await tx.playerCosmetic.findFirst({
      where: { id: cosmeticId, playerId }
    });
    if (!owned) throw new Error("Objet cosmetique introuvable.");

    const before = sumBonuses(
      await tx.playerCosmetic.findMany({ where: { playerId, equippedSlot: { not: null } } })
    );

    await tx.playerCosmetic.updateMany({
      where: { playerId, equippedSlot: slotIndex },
      data: { equippedSlot: null }
    });
    const equipped = await tx.playerCosmetic.update({
      where: { id: owned.id },
      data: { equippedSlot: slotIndex }
    });
    await updatePlayerStatsForEquipment(tx, playerId, before);

    return cosmeticPublicPayload(equipped);
  });
}

export async function unequipCosmetic(playerId: string, cosmeticId: string) {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.playerCosmetic.findFirst({
      where: { id: cosmeticId, playerId }
    });
    if (!owned) throw new Error("Objet cosmetique introuvable.");

    const before = sumBonuses(
      await tx.playerCosmetic.findMany({ where: { playerId, equippedSlot: { not: null } } })
    );
    const updated = await tx.playerCosmetic.update({
      where: { id: owned.id },
      data: { equippedSlot: null }
    });
    await updatePlayerStatsForEquipment(tx, playerId, before);

    return cosmeticPublicPayload(updated);
  });
}

export async function upgradeCosmetic(playerId: string, cosmeticId: string) {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.playerCosmetic.findFirst({
      where: { id: cosmeticId, playerId }
    });
    if (!owned) throw new Error("Objet cosmetique introuvable.");
    const upgradeLevel = Math.max(0, Math.min(3, (owned as CosmeticBonusSource).upgradeLevel ?? 0));
    if (upgradeLevel >= 3) throw new Error("Objet deja au niveau maximum.");

    const cost = cosmeticUpgradeCost(owned.rarity, upgradeLevel + 1);
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    if (player.budget < cost) throw new Error(`Budget insuffisant. Il faut ${cost} €.`);

    const before = sumBonuses(
      await tx.playerCosmetic.findMany({ where: { playerId, equippedSlot: { not: null } } })
    );

    await tx.player.update({
      where: { id: playerId },
      data: { budget: { decrement: cost } }
    });
    const updated = await tx.playerCosmetic.update({
      where: { id: owned.id },
      data: { upgradeLevel: upgradeLevel + 1 } as unknown as Prisma.PlayerCosmeticUpdateInput
    });

    if (owned.equippedSlot !== null) await updatePlayerStatsForEquipment(tx, playerId, before);

    return cosmeticPublicPayload(updated);
  });
}

export function cosmeticMarketCatalog() {
  return Object.entries(marketRecipes).map(([rarity, recipe]) => ({
    rarity,
    ...recipe
  }));
}

export async function exchangeCosmeticsOnMarket(playerId: string, rarity: string) {
  const recipe = marketRecipes[rarity];
  if (!recipe) throw new Error("Recette du marché inconnue.");

  return prisma.$transaction(async (tx) => {
    const available = await tx.playerCosmetic.findMany({
      where: { playerId, rarity },
      orderBy: { ownedAt: "asc" }
    });
    const owned = available
      .sort((first, second) => {
        if (first.equippedSlot === null && second.equippedSlot !== null) return -1;
        if (first.equippedSlot !== null && second.equippedSlot === null) return 1;
        return first.ownedAt.getTime() - second.ownedAt.getTime();
      })
      .slice(0, recipe.required);
    if (owned.length < recipe.required) {
      throw new Error(
        `Marché impossible : ${recipe.required} objet(s) ${rarity} requis, ${owned.length} disponible(s).`
      );
    }

    const before = sumBonuses(
      await tx.playerCosmetic.findMany({ where: { playerId, equippedSlot: { not: null } } })
    );
    const refund = cosmeticMarketRefundForItems(owned);
    const totalMoney = (recipe.money ?? 0) + refund;

    await tx.playerCosmetic.deleteMany({
      where: { id: { in: owned.map((item) => item.id) }, playerId }
    });

    let created: PlayerCosmetic | null = null;
    if (totalMoney > 0) {
      await tx.player.update({
        where: { id: playerId },
        data: { budget: { increment: totalMoney } }
      });
    }
    if (recipe.resultRarity) {
      const seed = `${playerId}-${rarity}-${recipe.resultRarity}-${Date.now()}`;
      const cosmeticId = `market-${seededPick(seed, 1, 1_000_000_000)}-${Date.now()}`;
      created = await tx.playerCosmetic.create({
        data: {
          playerId,
          cosmeticId,
          name: pickCosmeticName(cosmeticId),
          rarity: recipe.resultRarity,
          bonuses: encodeJson(generateCosmeticBonuses(cosmeticId, recipe.resultRarity)),
          upgradeLevel: 0
        }
      });
    }

    await updatePlayerStatsForEquipment(tx, playerId, before);

    return {
      recipe: recipe.label,
      consumed: owned.length,
      rarity,
      resultRarity: recipe.resultRarity ?? null,
      money: recipe.money ?? 0,
      refund,
      totalMoney,
      cosmetic: created ? cosmeticPublicPayload(created) : null
    };
  });
}
