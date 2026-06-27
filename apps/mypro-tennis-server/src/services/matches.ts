import { prisma } from "@mypro/database";
import { getActionEnergySnapshot, rankingDelta } from "@mypro/core";
import {
  SeededRandom,
  simulateMatch,
  type EnginePlayer,
  type MatchFormat
} from "@mypro/match-engine-tennis";
import {
  calculateFftRanking,
  getCareerStage,
  type FftFullRanking,
  type FftRanking,
  type RiskMode,
  type TennisSurface,
  type TennisStats,
  type TennisTactic
} from "@mypro/sports-tennis";
import type { Player } from "@prisma/client";
import { awardChestForWin } from "./chests";
import { decodeJson, encodeJson } from "./json";

function matchEnergyForPlayer(player: Player, seed: string, aiRange: [number, number]) {
  if (!player.isAi) {
    const snapshot = getActionEnergySnapshot(player.actionEnergy, player.actionEnergyUpdatedAt);
    return Math.max(0, Math.min(10, snapshot.value));
  }
  return new SeededRandom(seed).int(aiRange[0], aiRange[1]);
}

export function toEnginePlayer(
  player: Player,
  tactic: TennisTactic,
  risk: RiskMode,
  matchEnergy: number
): EnginePlayer {
  return {
    id: player.id,
    name: `${player.firstName} ${player.lastName}`,
    stats: decodeJson<TennisStats>(player.stats),
    matchEnergy,
    energy: player.energy,
    morale: player.morale,
    fatigue: player.fatigue,
    health: player.health,
    confidence: decodeJson<TennisStats>(player.stats).confidence,
    recentForm: player.recentForm,
    tactic,
    risk
  };
}

export async function createServerMatch(input: {
  playerAId: string;
  playerBId: string;
  surface: TennisSurface;
  tactic: TennisTactic;
  risk: RiskMode;
  format: MatchFormat;
  type: string;
}) {
  const [playerA, playerB] = await Promise.all([
    prisma.player.findFirstOrThrow({ where: { id: input.playerAId } }),
    prisma.player.findFirstOrThrow({ where: { id: input.playerBId } })
  ]);
  const seed = `${input.playerAId}-${input.playerBId}-${Date.now()}-${input.surface}`;
  const aiEnergyRange: [number, number] = input.type.includes("Championnat individuel")
    ? [1, 7]
    : [0, 10];
  const replay = simulateMatch({
    playerA: toEnginePlayer(
      playerA,
      input.tactic,
      input.risk,
      matchEnergyForPlayer(playerA, `${seed}-a`, aiEnergyRange)
    ),
    playerB: toEnginePlayer(
      playerB,
      "Équilibré",
      "Normale",
      matchEnergyForPlayer(playerB, `${seed}-b`, aiEnergyRange)
    ),
    surface: input.surface,
    format: input.format,
    seed
  });
  const winner = replay.winnerId === playerA.id ? playerA : playerB;
  const loser = replay.winnerId === playerA.id ? playerB : playerA;
  const delta = rankingDelta(winner.worldRank, loser.worldRank, input.type === "Tournoi" ? 1.8 : 1);
  const officialAmateur = input.type.includes("officiel amateur") || input.type === "Tournoi";
  const individualChampionshipWinPrize =
    input.type.includes("Championnat individuel") && !winner.isAi ? 100 : 0;

  const match = await prisma.$transaction(async (tx) => {
    const created = await tx.match.create({
      data: {
        playerAId: playerA.id,
        playerBId: playerB.id,
        winnerId: replay.winnerId,
        type: input.type,
        surface: replay.surface,
        format: replay.format,
        scoreText: replay.scoreText,
        durationMinutes: replay.durationMinutes,
        replay: encodeJson(replay)
      }
    });
    if (officialAmateur) {
      await tx.fftResult.createMany({
        data: [
          {
            playerId: playerA.id,
            matchId: created.id,
            competitionType: input.type,
            won: replay.winnerId === playerA.id,
            ownRanking: playerA.fftRanking,
            opponentRanking: playerB.fftRanking,
            coefficient: 1
          },
          {
            playerId: playerB.id,
            matchId: created.id,
            competitionType: input.type,
            won: replay.winnerId === playerB.id,
            ownRanking: playerB.fftRanking,
            opponentRanking: playerA.fftRanking,
            coefficient: 1
          }
        ]
      });
    }

    const refreshFft = async (player: Player) => {
      if (!officialAmateur || player.proUnlocked) return {};
      const results = await tx.fftResult.findMany({ where: { playerId: player.id } });
      const calculation = calculateFftRanking({
        currentRanking: player.fftRanking as FftFullRanking,
        gender: player.gender as "Femme" | "Homme",
        results: results.map((result) => ({
          won: result.won,
          opponentRanking: result.opponentRanking as FftFullRanking,
          playedAt: result.playedAt,
          coefficient: result.coefficient
        }))
      });
      return {
        amateurPoints: calculation.points,
        fftRanking: calculation.ranking,
        fftRankingValidated: calculation.fftRankingValidated,
        proUnlocked: calculation.proUnlocked,
        careerStage: getCareerStage(calculation.ranking as FftRanking, calculation.proUnlocked)
      };
    };

    await tx.player.update({
      where: { id: winner.id },
      data: {
        wins: { increment: 1 },
        rankingPoints: { increment: delta },
        fatigue: { increment: 8 },
        energy: { decrement: 10 },
        reputation: { increment: 1 },
        budget: { increment: individualChampionshipWinPrize },
        ...(await refreshFft(winner))
      }
    });
    await tx.player.update({
      where: { id: loser.id },
      data: {
        losses: { increment: 1 },
        rankingPoints: { increment: Math.max(3, Math.round(delta * 0.22)) },
        fatigue: { increment: 9 },
        energy: { decrement: 11 },
        ...(await refreshFft(loser))
      }
    });
    await awardChestForWin(winner, tx, input.type);
    await awardChestForWin(loser, tx, `Défaite - ${input.type}`, "Bronze");
    return created;
  });

  return match;
}
