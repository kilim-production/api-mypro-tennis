import type { Player } from "@prisma/client";
import { decodeJson } from "./json";
import { actionEnergyPayload, actionEnergyPayloadWithClub } from "./actionEnergy";

export function publicPlayer(player: Player) {
  return publicPlayerBase(player, actionEnergyPayload(player));
}

export async function publicPlayerWithClubBonuses(player: Player) {
  return publicPlayerBase(player, await actionEnergyPayloadWithClub(player));
}

function publicPlayerBase(player: Player, actionEnergy: ReturnType<typeof actionEnergyPayload>) {
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
    stats: decodeJson(player.stats),
    ...actionEnergy,
    energy: player.energy,
    morale: player.morale,
    fatigue: player.fatigue,
    health: player.health,
    reputation: player.reputation,
    budget: player.budget,
    gems: player.gems,
    careerCashPrizeWon: player.careerCashPrizeWon,
    overall: player.overall,
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
