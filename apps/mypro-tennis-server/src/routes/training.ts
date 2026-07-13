import { Router } from "express";
import { prisma } from "@mypro/database";
import { calculateOverall, clamp, scaleDevelopmentCost, scaleDevelopmentMinutes, trainingGain, trainingPowerLevel } from "@mypro/core";
import { trainingStartSchema } from "@mypro/shared";
import { trainings, type TennisStats } from "@mypro/sports-tennis";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { spendCareerAction } from "../services/actionEnergy";
import { decodeJson, encodeJson } from "../services/json";

export const trainingRouter = Router();

trainingRouter.get("/", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  const sessions = player
    ? await prisma.trainingSession.findMany({ where: { playerId: player.id }, orderBy: { startedAt: "desc" } })
    : [];
  const powerLevel = player ? trainingPowerLevel(player.overall) : 1;
  const catalog = trainings.map((training) => ({
    ...training,
    durationMinutes: scaleDevelopmentMinutes(training.durationMinutes, powerLevel, 1.18),
    cost: scaleDevelopmentCost(training.cost, powerLevel, 1.16),
    powerLevel,
    actionEnergyCost: 1
  }));
  return response.json({ catalog, sessions: sessions.map((session) => ({ ...session, gains: decodeJson(session.gains) })) });
});

trainingRouter.post("/start", requireAuth, validateBody(trainingStartSchema), async (request, response) => {
  const training = trainings.find((item) => item.id === request.body.trainingId);
  if (!training) return response.status(404).json({ message: "Entraînement inconnu." });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Créez votre joueur avant de vous entraîner." });
  const powerLevel = trainingPowerLevel(player.overall);
  const scaledCost = scaleDevelopmentCost(training.cost, powerLevel, 1.16);
  const scaledDurationMinutes = scaleDevelopmentMinutes(training.durationMinutes, powerLevel, 1.18);
  if (player.budget < scaledCost)
    return response.status(400).json({ message: "Crédits insuffisants." });
  const active = await prisma.trainingSession.findFirst({ where: { playerId: player.id, status: "ACTIVE" } });
  if (active) return response.status(409).json({ message: "Un entraînement est déjà en cours." });
  const endsAt = new Date(Date.now() + scaledDurationMinutes * 60_000);
  try {
    const session = await prisma.$transaction(async (tx) => {
      await spendCareerAction(player, tx);
      const created = await tx.trainingSession.create({
        data: {
          playerId: player.id,
          trainingId: training.id,
          name: training.name,
          category: training.category,
          endsAt,
          gains: encodeJson(training.gains),
          fatigue: training.fatigue,
          cost: scaledCost
        }
      });
      await tx.player.update({ where: { id: player.id }, data: { budget: { decrement: scaledCost } } });
      return created;
    });
    return response.status(201).json({ ...session, gains: decodeJson(session.gains) });
  } catch (error) {
    return response.status(429).json({ message: error instanceof Error ? error.message : "Énergie insuffisante." });
  }
});

trainingRouter.post("/:id/complete", requireAuth, async (request, response) => {
  const sessionId = request.params.id;
  if (!sessionId) return response.status(400).json({ message: "Identifiant de séance requis." });
  const player = await prisma.player.findUnique({
    where: { userId: request.session!.userId }
  });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const session = await prisma.trainingSession.findFirst({ where: { id: sessionId, playerId: player.id } });
  if (!session) return response.status(404).json({ message: "Séance introuvable." });
  if (session.status === "COMPLETED") return response.json({ ...session, gains: decodeJson(session.gains) });
  if (session.endsAt.getTime() > Date.now()) {
    return response.status(400).json({ message: "La séance n'est pas encore terminée." });
  }

  const stats = { ...decodeJson<TennisStats>(player.stats) };
  for (const [key, value] of Object.entries(decodeJson<Record<string, number>>(session.gains))) {
    stats[key as keyof TennisStats] = clamp(
      stats[key as keyof TennisStats] + trainingGain(value, 0, 0, player.fatigue)
    );
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.trainingSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: new Date() }
    });
    return tx.player.update({
      where: { id: player.id },
      data: {
        stats: encodeJson(stats),
        fatigue: { increment: session.fatigue },
        energy: { decrement: Math.round(session.fatigue * 0.6) },
        morale: { increment: 1 },
        overall: calculateOverall(stats)
      }
    });
  });
  return response.json(updated);
});
