import { Router } from "express";
import { prisma } from "@mypro/database";
import { avatarUpdateSchema, playerCreationSchema, playerProfileUpdateSchema } from "@mypro/shared";
import {
  calculateFftRanking,
  createStatsForArchetype,
  fftDeltaBonus,
  fftNorms,
  fftRankIndex,
  fftVictoryPoints,
  nextFftRanking,
  type FftFullRanking
} from "@mypro/sports-tennis";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { publicPlayer } from "../services/playerMapper";
import { encodeJson } from "../services/json";
import { awardChestForWin } from "../services/chests";

export const playersRouter = Router();

function updateAvatarInitials(avatar: string, initials: string) {
  try {
    const parsed = JSON.parse(avatar) as { type?: string; picture?: unknown };
    if (parsed.type === "picture-v1" && parsed.picture) {
      return encodeJson({ ...parsed, initials });
    }
  } catch {
    return avatar;
  }
  return avatar;
}

playersRouter.get("/", async (_request, response) => {
  const players = await prisma.player.findMany({ orderBy: { worldRank: "asc" }, take: 100 });
  return response.json(players.map(publicPlayer));
});

playersRouter.get("/me/career", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({
    where: { userId: request.session!.userId },
    include: {
      fftResults: { orderBy: { playedAt: "desc" } },
      seasonCompetitionEntries: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });

  const results = player.fftResults.map((result) => ({
    won: result.won,
    opponentRanking: result.opponentRanking as FftFullRanking,
    playedAt: result.playedAt,
    coefficient: result.coefficient
  }));
  const simulation = calculateFftRanking({
    currentRanking: player.fftRanking as FftFullRanking,
    gender: player.gender as "Femme" | "Homme",
    results
  });
  const genderKey = player.gender === "Homme" ? "male" : "female";
  const simulatedRanking = simulation.ranking as FftFullRanking;
  const nextRanking = nextFftRanking(simulatedRanking as never) as FftFullRanking | null;
  const currentNorm = fftNorms[simulatedRanking]?.[genderKey];
  const nextNorm = nextRanking ? fftNorms[nextRanking]?.[genderKey] : null;
  const wins = results.filter((result) => result.won);
  const losses = results.filter((result) => !result.won);
  const equalLosses = losses.filter(
    (result) => fftRankIndex(result.opponentRanking) === fftRankIndex(simulatedRanking)
  ).length;
  const oneBelowLosses = losses.filter(
    (result) => fftRankIndex(result.opponentRanking) === fftRankIndex(simulatedRanking) - 1
  ).length;
  const bigLosses = losses.filter(
    (result) => fftRankIndex(result.opponentRanking) <= fftRankIndex(simulatedRanking) - 2
  ).length;
  const delta = wins.length - equalLosses - 2 * oneBelowLosses - 5 * bigLosses;
  const winsToKeep = Math.max(0, (currentNorm?.wins ?? 0) + fftDeltaBonus(simulatedRanking, delta));
  const victoryDetails = player.fftResults
    .filter((result) => result.won)
    .map((result) => ({
      id: result.id,
      playedAt: result.playedAt,
      competitionType: result.competitionType,
      opponentRanking: result.opponentRanking,
      points: fftVictoryPoints(
        simulatedRanking,
        result.opponentRanking as FftFullRanking,
        result.coefficient
      ),
      coefficient: result.coefficient
    }))
    .sort((a, b) => b.points - a.points)
    .map((result, index) => ({ ...result, retained: index < winsToKeep }));

  const titleEntries = player.seasonCompetitionEntries.filter((entry) =>
    ["VAINQUEUR", "CHAMPION_NATIONAL"].includes(entry.status)
  );
  const tournamentTitles = titleEntries.filter((entry) => entry.status === "VAINQUEUR").length;
  const nationalTitles = titleEntries.filter(
    (entry) => entry.status === "CHAMPION_NATIONAL"
  ).length;
  const finals = player.seasonCompetitionEntries.filter(
    (entry) =>
      ["VAINQUEUR", "CHAMPION_NATIONAL", "ELIMINE"].includes(entry.status) &&
      entry.currentRound >= 3
  ).length;
  const competitionStats = player.seasonCompetitionEntries.reduce<
    Record<string, { played: number; titles: number; bestRound: number }>
  >((acc, entry) => {
    const key = entry.competitionType;
    acc[key] ??= { played: 0, titles: 0, bestRound: 0 };
    acc[key].played += 1;
    acc[key].bestRound = Math.max(acc[key].bestRound, entry.currentRound);
    if (["VAINQUEUR", "CHAMPION_NATIONAL"].includes(entry.status)) acc[key].titles += 1;
    return acc;
  }, {});

  return response.json({
    palmares: {
      titles: titleEntries.length,
      tournamentTitles,
      nationalTitles,
      finals,
      wins: player.wins,
      losses: player.losses,
      competitions: Object.entries(competitionStats).map(([type, stats]) => ({ type, ...stats })),
      recentTitles: titleEntries.slice(0, 6).map((entry) => ({
        id: entry.id,
        label: entry.championTitle ?? entry.label,
        type: entry.competitionType,
        date: entry.updatedAt,
        status: entry.status
      }))
    },
    rankingSimulation: {
      currentRanking: player.fftRanking,
      simulatedRanking: simulation.ranking,
      points: simulation.points,
      minimum: currentNorm?.minimum ?? 0,
      nextRanking,
      nextMinimum: nextNorm?.minimum ?? null,
      pointsToNext: nextNorm ? Math.max(0, nextNorm.minimum - simulation.points) : null,
      takenWins: simulation.takenWins,
      winsToKeep,
      delta,
      matchCount: simulation.matchCount,
      wins: simulation.wins,
      losses: simulation.losses,
      fftRankingValidated: simulation.fftRankingValidated,
      proUnlocked: simulation.proUnlocked,
      victories: victoryDetails,
      results: player.fftResults.slice(0, 12).map((result) => ({
        id: result.id,
        playedAt: result.playedAt,
        competitionType: result.competitionType,
        won: result.won,
        ownRanking: result.ownRanking,
        opponentRanking: result.opponentRanking,
        coefficient: result.coefficient
      }))
    }
  });
});

playersRouter.post(
  "/",
  requireAuth,
  validateBody(playerCreationSchema),
  async (request, response) => {
    const existing = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (existing)
      return response.status(409).json({ message: "Un joueur existe déjà pour ce compte." });
    const stats = createStatsForArchetype(request.body.archetype);
    const initials =
      `${request.body.firstName[0] ?? "M"}${request.body.lastName[0] ?? "P"}`.toUpperCase();
    const avatar = encodeJson({
      type: "picture-v1",
      initials,
      picture: request.body.avatarPicture ?? { kind: "preset", id: "pp-01" }
    });
    const player = await prisma.$transaction(async (tx) => {
      const created = await tx.player.create({
        data: {
          userId: request.session!.userId,
          firstName: request.body.firstName,
          lastName: request.body.lastName,
          nationality: request.body.nationality,
          gender: request.body.gender,
          dominantHand: request.body.dominantHand,
          backhand: request.body.backhand,
          archetype: request.body.archetype,
          avatar,
          stats: encodeJson(stats),
          overall: 0,
          rankingPoints: 0,
          worldRank: 999,
          fftRanking: "NC",
          amateurPoints: 0,
          careerStage: "Amateur",
          proUnlocked: false
        }
      });
      for (const rarity of ["Bronze", "Bronze", "Argent", "Or"] as const) {
        await awardChestForWin({ id: created.id, isAi: false }, tx, "Cadeau de départ", rarity);
      }
      await tx.notification.create({
        data: {
          userId: request.session!.userId,
          title: "Bienvenue dans MyPro",
          body: "Votre carrière commence avec 2 sacs Bronze, 1 sac Argent et 1 sac Or.",
          type: "TUTORIEL"
        }
      });
      return created;
    });
    return response.status(201).json(publicPlayer(player));
  }
);

playersRouter.patch(
  "/me/profile",
  requireAuth,
  validateBody(playerProfileUpdateSchema),
  async (request, response) => {
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });

    const initials =
      `${request.body.firstName[0] ?? "M"}${request.body.lastName[0] ?? "P"}`.toUpperCase();
    const updated = await prisma.player.update({
      where: { id: player.id },
      data: {
        firstName: request.body.firstName,
        lastName: request.body.lastName,
        nationality: request.body.nationality,
        gender: request.body.gender,
        dominantHand: request.body.dominantHand,
        backhand: request.body.backhand,
        avatar: updateAvatarInitials(player.avatar, initials)
      }
    });

    return response.json(publicPlayer(updated));
  }
);

playersRouter.patch(
  "/me/avatar",
  requireAuth,
  validateBody(avatarUpdateSchema),
  async (request, response) => {
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });

    const initials = `${player.firstName[0] ?? "M"}${player.lastName[0] ?? "P"}`.toUpperCase();
    const avatar = encodeJson({
      type: "picture-v1",
      initials,
      picture: request.body.avatarPicture
    });
    const updated = await prisma.player.update({
      where: { id: player.id },
      data: { avatar }
    });

    return response.json(publicPlayer(updated));
  }
);

playersRouter.get("/:id", async (request, response) => {
  const player = await prisma.player.findUnique({ where: { id: request.params.id } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  return response.json(publicPlayer(player));
});
