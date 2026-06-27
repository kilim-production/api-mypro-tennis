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

export function cosmeticPublicPayload(cosmetic: PlayerCosmetic) {
  const stored = decodeJson<Partial<TennisStats>>(cosmetic.bonuses);
  const bonuses = Object.keys(stored).length
    ? stored
    : generateCosmeticBonuses(cosmetic.cosmeticId, cosmetic.rarity);
  return {
    id: cosmetic.id,
    cosmeticId: cosmetic.cosmeticId,
    name: cosmetic.name,
    rarity: cosmetic.rarity,
    bonuses,
    equippedSlot: cosmetic.equippedSlot,
    ownedAt: cosmetic.ownedAt
  };
}

function sumBonuses(cosmetics: Array<Pick<PlayerCosmetic, "bonuses" | "cosmeticId" | "rarity">>) {
  const total: Partial<TennisStats> = {};
  for (const cosmetic of cosmetics) {
    const stored = decodeJson<Partial<TennisStats>>(cosmetic.bonuses);
    const bonuses = Object.keys(stored).length
      ? stored
      : generateCosmeticBonuses(cosmetic.cosmeticId, cosmetic.rarity);
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
