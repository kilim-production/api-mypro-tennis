import type { Player, Prisma } from "@prisma/client";
import {
  calculateOverall,
  PLAYER_MAX_LEVEL,
  playerLevelFromXp,
  playerLevelProgress
} from "@mypro/core";
import { fftRankIndex, playableStatKeys, type TennisStats } from "@mypro/sports-tennis";
import { prisma } from "@mypro/database";
import { decodeJson, encodeJson } from "./json";

const playableSet = new Set<string>(playableStatKeys);
const SKILL_STAT_CAP = 20;
const MILESTONE_LEVELS = [10, 25, 50, 75, 100] as const;

export type SkillAllocationMap = Record<string, number>;
export type ArchetypePerk = {
  level: number;
  title: string;
  description: string;
  bonuses: Partial<Record<keyof TennisStats, number>>;
};

const archetypePerks: Record<string, ArchetypePerk[]> = {
  "Gros service": [
    {
      level: 10,
      title: "Première balle lourde",
      description: "+1 Service et +1 Force en match.",
      bonuses: { service: 1, strength: 1 }
    },
    {
      level: 25,
      title: "Point court",
      description: "+1 Service et +1 Smash en match.",
      bonuses: { service: 1, smash: 1 }
    },
    {
      level: 50,
      title: "Serveur dominant",
      description: "+2 Service en match.",
      bonuses: { service: 2 }
    },
    {
      level: 75,
      title: "Sous pression",
      description: "+1 Service, +1 Explosivité et +1 Récupération en match.",
      bonuses: { service: 1, explosiveness: 1, recovery: 1 }
    },
    {
      level: 100,
      title: "Canon MyPro",
      description: "+2 Service, +1 Force et +1 Smash en match.",
      bonuses: { service: 2, strength: 1, smash: 1 }
    }
  ],
  Relanceur: [
    {
      level: 10,
      title: "Lecture du service",
      description: "+1 Retour et +1 Vitesse en match.",
      bonuses: { return: 1, speed: 1 }
    },
    {
      level: 25,
      title: "Contre croisé",
      description: "+1 Retour et +1 Revers en match.",
      bonuses: { return: 1, backhand: 1 }
    },
    {
      level: 50,
      title: "Mur de relance",
      description: "+2 Retour en match.",
      bonuses: { return: 2 }
    },
    {
      level: 75,
      title: "Rally long",
      description: "+1 Retour, +1 Endurance et +1 Récupération en match.",
      bonuses: { return: 1, stamina: 1, recovery: 1 }
    },
    {
      level: 100,
      title: "Briseur de rythme",
      description: "+2 Retour, +1 Vitesse et +1 Revers en match.",
      bonuses: { return: 2, speed: 1, backhand: 1 }
    }
  ],
  "Frappeur de fond": [
    {
      level: 10,
      title: "Coup droit lourd",
      description: "+1 Coup droit et +1 Force en match.",
      bonuses: { forehand: 1, strength: 1 }
    },
    {
      level: 25,
      title: "Revers solide",
      description: "+1 Coup droit et +1 Revers en match.",
      bonuses: { forehand: 1, backhand: 1 }
    },
    {
      level: 50,
      title: "Cadence élevée",
      description: "+1 Coup droit, +1 Revers et +1 Endurance en match.",
      bonuses: { forehand: 1, backhand: 1, stamina: 1 }
    },
    {
      level: 75,
      title: "Domination du fond",
      description: "+2 Coup droit et +1 Force en match.",
      bonuses: { forehand: 2, strength: 1 }
    },
    {
      level: 100,
      title: "Marteau de fond",
      description: "+2 Coup droit, +1 Revers et +1 Explosivité en match.",
      bonuses: { forehand: 2, backhand: 1, explosiveness: 1 }
    }
  ],
  "Athlète endurant": [
    {
      level: 10,
      title: "Caisse physique",
      description: "+1 Endurance et +1 Récupération en match.",
      bonuses: { stamina: 1, recovery: 1 }
    },
    {
      level: 25,
      title: "Jambes rapides",
      description: "+1 Endurance et +1 Vitesse en match.",
      bonuses: { stamina: 1, speed: 1 }
    },
    {
      level: 50,
      title: "Match long",
      description: "+2 Endurance en match.",
      bonuses: { stamina: 2 }
    },
    {
      level: 75,
      title: "Corps solide",
      description: "+1 Endurance, +1 Récupération et +1 Force en match.",
      bonuses: { stamina: 1, recovery: 1, strength: 1 }
    },
    {
      level: 100,
      title: "Moteur infatigable",
      description: "+2 Endurance, +1 Récupération et +1 Vitesse en match.",
      bonuses: { stamina: 2, recovery: 1, speed: 1 }
    }
  ],
  "Joueur complet": [
    {
      level: 10,
      title: "Base complète",
      description: "+1 Service et +1 Retour en match.",
      bonuses: { service: 1, return: 1 }
    },
    {
      level: 25,
      title: "Sans faiblesse",
      description: "+1 Coup droit et +1 Revers en match.",
      bonuses: { forehand: 1, backhand: 1 }
    },
    {
      level: 50,
      title: "Adaptation",
      description: "+1 Vitesse, +1 Endurance et +1 Récupération en match.",
      bonuses: { speed: 1, stamina: 1, recovery: 1 }
    },
    {
      level: 75,
      title: "Polyvalence supérieure",
      description: "+1 Service, +1 Retour et +1 Coup droit en match.",
      bonuses: { service: 1, return: 1, forehand: 1 }
    },
    {
      level: 100,
      title: "Profil total",
      description: "+1 sur Service, Retour, Coup droit et Revers en match.",
      bonuses: { service: 1, return: 1, forehand: 1, backhand: 1 }
    }
  ]
};

function normalizedArchetype(archetype: string) {
  if (archetype.includes("service")) return "Gros service";
  if (archetype.includes("Relanceur")) return "Relanceur";
  if (archetype.includes("Frappeur")) return "Frappeur de fond";
  if (archetype.includes("endurant")) return "Athlète endurant";
  return "Joueur complet";
}

export function archetypePerksForPlayer(player: Pick<Player, "archetype" | "playerLevel">) {
  const archetype = normalizedArchetype(player.archetype);
  const perks = archetypePerks[archetype] ?? archetypePerks["Joueur complet"] ?? [];
  return perks.map((perk) => ({
    ...perk,
    unlocked: player.playerLevel >= perk.level,
    active: player.playerLevel >= perk.level
  }));
}

export function archetypeMatchBonuses(player: Pick<Player, "archetype" | "playerLevel">) {
  const bonuses: Partial<Record<keyof TennisStats, number>> = {};
  for (const perk of archetypePerksForPlayer(player)) {
    if (!perk.unlocked) continue;
    for (const [key, value] of Object.entries(perk.bonuses)) {
      bonuses[key as keyof TennisStats] = (bonuses[key as keyof TennisStats] ?? 0) + (value ?? 0);
    }
  }
  return bonuses;
}

export function applyArchetypeMatchBonuses(player: Pick<Player, "archetype" | "playerLevel" | "stats">) {
  const stats = { ...decodeJson<TennisStats>(player.stats) };
  const bonuses = archetypeMatchBonuses(player);
  for (const [key, value] of Object.entries(bonuses)) {
    stats[key as keyof TennisStats] = Math.min(
      100,
      (stats[key as keyof TennisStats] ?? 0) + (value ?? 0)
    );
  }
  return stats;
}

export function careerXpForMatch(params: {
  won: boolean;
  official: boolean;
  opponentRanking: string;
  playerRanking: string;
  type: string;
}) {
  const base = params.official ? 42 : 22;
  const winBonus = params.won ? (params.official ? 58 : 28) : 10;
  const rankingDelta = fftRankIndex(params.opponentRanking) - fftRankIndex(params.playerRanking);
  const performanceBonus = params.won ? Math.max(0, rankingDelta) * 8 : 0;
  const teamBonus = params.type.includes("Championnat par équipe") ? 12 : 0;
  const championshipBonus = params.type.includes("Championnat individuel") ? 18 : 0;
  return Math.max(8, Math.round(base + winBonus + performanceBonus + teamBonus + championshipBonus));
}

export async function grantCareerXp(
  tx: Prisma.TransactionClient,
  player: Pick<Player, "id" | "isAi" | "userId" | "playerXp" | "playerLevel">,
  amount: number
) {
  if (player.isAi || amount <= 0) return null;
  const nextXp = Math.max(0, player.playerXp + Math.round(amount));
  const nextLevel = playerLevelFromXp(nextXp);
  const gainedLevels = Math.max(0, nextLevel - player.playerLevel);
  const updateData: Prisma.PlayerUpdateInput = {
    playerXp: nextXp,
    playerLevel: nextLevel
  };
  if (gainedLevels > 0) updateData.skillPoints = { increment: gainedLevels };
  const updated = await tx.player.update({
    where: { id: player.id },
    data: updateData
  });
  if (player.userId && gainedLevels > 0) {
    await tx.notification.create({
      data: {
        userId: player.userId,
        title: "Niveau joueur gagné",
        body: `Vous êtes niveau ${nextLevel}. ${gainedLevels} point(s) de compétence disponible(s).`,
        type: "SKILLS"
      }
    });
  }
  return updated;
}

export function skillProgressPayload(player: Player) {
  const allocations = decodeSkillAllocations(player.skillAllocations);
  return {
    level: player.playerLevel,
    xp: player.playerXp,
    skillPoints: player.skillPoints,
    spentSkillPoints: player.spentSkillPoints,
    maxLevel: PLAYER_MAX_LEVEL,
    progress: playerLevelProgress(player.playerXp),
    allocations,
    statCapPerSkill: SKILL_STAT_CAP,
    milestoneLevels: MILESTONE_LEVELS,
    archetype: normalizedArchetype(player.archetype),
    perks: archetypePerksForPlayer(player),
    activeMatchBonuses: archetypeMatchBonuses(player)
  };
}

function decodeSkillAllocations(value: string) {
  try {
    const parsed = decodeJson<SkillAllocationMap>(value);
    return Object.fromEntries(
      Object.entries(parsed).filter(([key, count]) => playableSet.has(key) && Number.isFinite(count))
    ) as SkillAllocationMap;
  } catch {
    return {};
  }
}

export async function getPlayerSkillState(playerId: string) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  return skillProgressPayload(player);
}

export async function spendSkillPoint(playerId: string, statKey: string) {
  if (!playableSet.has(statKey)) throw new Error("Statistique de compétence invalide.");
  return prisma.$transaction(async (tx) => {
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    if (player.skillPoints <= 0) throw new Error("Aucun point de compétence disponible.");

    const allocations = decodeSkillAllocations(player.skillAllocations);
    const currentAllocation = allocations[statKey] ?? 0;
    if (currentAllocation >= SKILL_STAT_CAP) {
      throw new Error(`Cette statistique a déjà reçu ${SKILL_STAT_CAP} points de compétence.`);
    }

    const stats = { ...decodeJson<TennisStats>(player.stats) };
    const currentStat = stats[statKey as keyof TennisStats] ?? 0;
    if (currentStat >= 100) throw new Error("Cette statistique est déjà au maximum.");
    stats[statKey as keyof TennisStats] = Math.min(100, currentStat + 1);
    allocations[statKey] = currentAllocation + 1;

    const updated = await tx.player.update({
      where: { id: player.id },
      data: {
        stats: encodeJson(stats),
        overall: calculateOverall(stats),
        skillPoints: { decrement: 1 },
        spentSkillPoints: { increment: 1 },
        skillAllocations: encodeJson(allocations)
      }
    });

    return skillProgressPayload(updated);
  });
}

export async function recalculateExistingPlayerXp() {
  const players = await prisma.player.findMany({
    where: { isAi: false },
    include: {
      matchesAsA: {
        include: { playerA: true, playerB: true }
      },
      matchesAsB: {
        include: { playerA: true, playerB: true }
      }
    }
  });

  const summaries: Array<{
    playerId: string;
    name: string;
    matchCount: number;
    xp: number;
    level: number;
    skillPoints: number;
    spentSkillPoints: number;
  }> = [];

  for (const player of players) {
    const matchesById = new Map([...player.matchesAsA, ...player.matchesAsB].map((match) => [match.id, match]));
    let xp = 0;

    for (const match of matchesById.values()) {
      const opponent = match.playerAId === player.id ? match.playerB : match.playerA;
      xp += careerXpForMatch({
        won: match.winnerId === player.id,
        official: match.type.includes("officiel amateur") || match.type === "Tournoi",
        opponentRanking: opponent.fftRanking,
        playerRanking: player.fftRanking,
        type: match.type
      });
    }

    const level = playerLevelFromXp(xp);
    const skillPoints = Math.max(0, level - player.spentSkillPoints);
    await prisma.player.update({
      where: { id: player.id },
      data: {
        playerXp: xp,
        playerLevel: level,
        skillPoints
      }
    });

    summaries.push({
      playerId: player.id,
      name: `${player.firstName} ${player.lastName}`,
      matchCount: matchesById.size,
      xp,
      level,
      skillPoints,
      spentSkillPoints: player.spentSkillPoints
    });
  }

  return summaries;
}

export async function recalculateExistingPlayerOveralls() {
  const players = await prisma.player.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      stats: true,
      overall: true
    }
  });
  const summaries: Array<{
    playerId: string;
    name: string;
    previousOverall: number;
    overall: number;
  }> = [];

  for (const player of players) {
    const overall = calculateOverall(decodeJson<TennisStats>(player.stats));
    if (overall === player.overall) continue;

    await prisma.player.update({
      where: { id: player.id },
      data: { overall }
    });
    summaries.push({
      playerId: player.id,
      name: `${player.firstName} ${player.lastName}`,
      previousOverall: player.overall,
      overall
    });
  }

  return {
    checked: players.length,
    updated: summaries.length,
    players: summaries
  };
}
