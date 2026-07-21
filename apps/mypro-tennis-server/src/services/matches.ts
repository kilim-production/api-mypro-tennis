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
  type TennisTactic
} from "@mypro/sports-tennis";
import type { Player, Prisma } from "@prisma/client";
import { awardChestForWin } from "./chests";
import { encodeJson } from "./json";
import { applyArchetypeMatchBonuses, careerXpForMatch, grantCareerXp } from "./playerProgression";
import { clampVital, normalizedPlayerVitals, playerVitalsAfterMatch } from "./playerVitals";
import { seasonPassXpMultiplier } from "./shop";

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
  const stats = applyArchetypeMatchBonuses(player);
  const vitals = normalizedPlayerVitals(player);
  return {
    id: player.id,
    name: `${player.firstName} ${player.lastName}`,
    stats,
    matchEnergy,
    energy: vitals.energy,
    morale: vitals.morale,
    fatigue: vitals.fatigue,
    health: vitals.health,
    confidence: stats.confidence,
    recentForm: clampVital(player.recentForm),
    tactic,
    risk
  };
}

export type ServerMatchOutcome = {
  winnerId: string;
  loserId: string;
  surface: TennisSurface;
  format: MatchFormat;
  scoreText: string;
  durationMinutes: number;
};

export async function persistServerMatchOutcome(
  tx: Prisma.TransactionClient,
  input: {
    playerA: Player;
    playerB: Player;
    type: string;
    replay: ServerMatchOutcome;
    replayPayload: unknown;
    awardChests?: boolean;
  }
) {
  const { playerA, playerB, replay } = input;
  const winner = replay.winnerId === playerA.id ? playerA : playerB;
  const loser = replay.winnerId === playerA.id ? playerB : playerA;
  const delta = rankingDelta(winner.worldRank, loser.worldRank, input.type === "Tournoi" ? 1.8 : 1);
  const officialAmateur = input.type.includes("officiel amateur") || input.type === "Tournoi";
  const individualChampionshipWinPrize =
    input.type.includes("Championnat individuel") && !winner.isAi ? 100 : 0;

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
      replay: encodeJson(input.replayPayload)
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

  const winnerBaseXp = careerXpForMatch({
    won: true,
    official: officialAmateur,
    opponentRanking: loser.fftRanking,
    playerRanking: winner.fftRanking,
    type: input.type
  });
  const loserBaseXp = careerXpForMatch({
    won: false,
    official: officialAmateur,
    opponentRanking: winner.fftRanking,
    playerRanking: loser.fftRanking,
    type: input.type
  });
  const [winnerXpMultiplier, loserXpMultiplier] = await Promise.all([
    seasonPassXpMultiplier(winner.id, tx),
    seasonPassXpMultiplier(loser.id, tx)
  ]);
  const winnerXp = Math.round(winnerBaseXp * winnerXpMultiplier);
  const loserXp = Math.round(loserBaseXp * loserXpMultiplier);
  const winnerVitals = playerVitalsAfterMatch(winner, true);
  const loserVitals = playerVitalsAfterMatch(loser, false);

  await tx.player.update({
    where: { id: winner.id },
    data: {
      wins: { increment: 1 },
      rankingPoints: { increment: delta },
      fatigue: winnerVitals.fatigue,
      energy: winnerVitals.energy,
      reputation: { increment: 1 },
      budget: { increment: individualChampionshipWinPrize },
      ...(await refreshFft(winner))
    }
  });
  await grantCareerXp(tx, winner, winnerXp);
  await tx.player.update({
    where: { id: loser.id },
    data: {
      losses: { increment: 1 },
      rankingPoints: { increment: Math.max(3, Math.round(delta * 0.22)) },
      fatigue: loserVitals.fatigue,
      energy: loserVitals.energy,
      ...(await refreshFft(loser))
    }
  });
  await grantCareerXp(tx, loser, loserXp);
  if (input.awardChests ?? true) {
    await awardChestForWin(winner, tx, input.type);
    await awardChestForWin(loser, tx, `Défaite - ${input.type}`, "Bronze");
  }
  return created;
}

export async function createServerMatch(input: {
  playerAId: string;
  playerBId: string;
  surface: TennisSurface;
  tactic: TennisTactic;
  risk: RiskMode;
  format: MatchFormat;
  type: string;
  seed?: string;
  awardChests?: boolean;
}) {
  const [playerA, playerB] = await Promise.all([
    prisma.player.findFirstOrThrow({ where: { id: input.playerAId } }),
    prisma.player.findFirstOrThrow({ where: { id: input.playerBId } })
  ]);
  const seed = input.seed ?? `${input.playerAId}-${input.playerBId}-${Date.now()}-${input.surface}`;
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
  return prisma.$transaction((tx) =>
    persistServerMatchOutcome(tx, {
      playerA,
      playerB,
      type: input.type,
      replay,
      replayPayload: replay,
      ...(input.awardChests === undefined ? {} : { awardChests: input.awardChests })
    })
  );
}
