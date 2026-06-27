import type { Player } from "@prisma/client";
import { decodeJson } from "./json";
import { actionEnergyPayload } from "./actionEnergy";

export function publicPlayer(player: Player) {
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
    ...actionEnergyPayload(player),
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
