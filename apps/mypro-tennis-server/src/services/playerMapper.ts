import type { Player } from "@prisma/client";
import { calculateOverall } from "@mypro/core";
import { decodeJson } from "./json";
import { actionEnergyPayload, actionEnergyPayloadWithClub } from "./actionEnergy";
import { normalizedPlayerVitals } from "./playerVitals";

export function publicPlayer(player: Player) {
  return publicPlayerBase(player, actionEnergyPayload(player));
}

export async function publicPlayerWithClubBonuses(player: Player) {
  return publicPlayerBase(player, await actionEnergyPayloadWithClub(player));
}

function publicPlayerBase(player: Player, actionEnergy: ReturnType<typeof actionEnergyPayload>) {
  const stats = decodeJson<Record<string, number>>(player.stats);
  const vitals = normalizedPlayerVitals(player);
  return {
    id: player.id,
    name: `${player.firstName} ${player.lastName}`,
    firstName: player.firstName,
    lastName: player.lastName,
    nationality: player.nationality,
    gender: player.gender,
    dominantHand: player.dominantHand,
    backhand: player.backhand,
    archetype: player.archetype,
    avatar: player.avatar,
    isAi: player.isAi,
    stats,
    ...actionEnergy,
    energy: vitals.energy,
    morale: vitals.morale,
    fatigue: vitals.fatigue,
    health: vitals.health,
    reputation: player.reputation,
    budget: player.budget,
    gems: player.gems,
    careerCashPrizeWon: player.careerCashPrizeWon,
    playerLevel: player.playerLevel,
    playerXp: player.playerXp,
    skillPoints: player.skillPoints,
    spentSkillPoints: player.spentSkillPoints,
    overall: calculateOverall(stats),
    rankingPoints: player.rankingPoints,
    worldRank: player.worldRank,
    fftRanking: player.fftRanking,
    fftRankingValidated: player.fftRankingValidated,
    amateurPoints: player.amateurPoints,
    careerStage: player.careerStage,
    proUnlocked: player.proUnlocked,
    recentForm: player.recentForm,
    wins: player.wins,
    losses: player.losses
  };
}
