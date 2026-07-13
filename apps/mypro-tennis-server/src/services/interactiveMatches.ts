import type { Player, Prisma } from "@prisma/client";
import { prisma } from "@mypro/database";
import {
  COACHING_INSTRUCTIONS,
  advanceInteractiveMatch,
  applyCoachingDecision,
  createInteractiveMatch,
  type CoachingInstructionId,
  type InteractiveMatchState,
  type MatchFormat
} from "@mypro/match-engine-tennis";
import type { RiskMode, TennisSurface, TennisTactic } from "@mypro/sports-tennis";
import { decodeJson, encodeJson } from "./json";
import { persistServerMatchOutcome, toEnginePlayer } from "./matches";
import { publicPlayer } from "./playerMapper";

const interactiveSessionInclude = {
  playerA: true,
  playerB: true
} satisfies Prisma.InteractiveMatchSessionInclude;

type InteractiveSessionWithPlayers = Prisma.InteractiveMatchSessionGetPayload<{
  include: typeof interactiveSessionInclude;
}>;

export class InteractiveMatchSessionError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

function isInstructionId(value: string): value is CoachingInstructionId {
  return COACHING_INSTRUCTIONS.some((instruction) => instruction.id === value);
}

function safeMatchState(state: InteractiveMatchState) {
  const safeState = { ...state } as Partial<InteractiveMatchState>;
  delete safeState.seed;
  delete safeState.players;
  return safeState as Omit<InteractiveMatchState, "seed" | "players">;
}

export function publicInteractiveMatchSession(session: InteractiveSessionWithPlayers) {
  const state = decodeJson<InteractiveMatchState>(session.state);
  return {
    id: session.id,
    type: session.type,
    surface: session.surface,
    format: session.format,
    status: session.status,
    revision: session.revision,
    completedMatchId: session.completedMatchId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    playerA: publicPlayer(session.playerA),
    playerB: publicPlayer(session.playerB),
    coachingInstructions: COACHING_INSTRUCTIONS,
    matchState: safeMatchState(state)
  };
}

async function ownedSession(sessionId: string, userId: string) {
  const session = await prisma.interactiveMatchSession.findUnique({
    where: { id: sessionId },
    include: interactiveSessionInclude
  });
  if (!session || session.playerA.userId !== userId) {
    throw new InteractiveMatchSessionError("Session de match introuvable.", 404);
  }
  return session;
}

export async function activeInteractiveMatchSession(playerId: string) {
  return prisma.interactiveMatchSession.findFirst({
    where: { playerAId: playerId, status: { in: ["ACTIVE", "COMPLETING"] } },
    include: interactiveSessionInclude,
    orderBy: { updatedAt: "desc" }
  });
}

export async function getInteractiveMatchSession(sessionId: string, userId: string) {
  return publicInteractiveMatchSession(await ownedSession(sessionId, userId));
}

export async function getActiveInteractiveMatchSession(playerId: string) {
  const session = await activeInteractiveMatchSession(playerId);
  return session ? publicInteractiveMatchSession(session) : null;
}

export async function createInteractiveMatchSession(input: {
  playerA: Player;
  playerB: Player;
  surface: TennisSurface;
  tactic: TennisTactic;
  risk: RiskMode;
  format: MatchFormat;
  type: string;
}) {
  const existing = await activeInteractiveMatchSession(input.playerA.id);
  if (existing) return { created: false, session: publicInteractiveMatchSession(existing) };

  const seed = `${input.playerA.id}-${input.playerB.id}-${Date.now()}-${input.surface}`;
  const state = createInteractiveMatch({
    playerA: toEnginePlayer(input.playerA, input.tactic, input.risk, input.playerA.actionEnergy),
    playerB: toEnginePlayer(input.playerB, "Équilibré", "Normale", input.playerB.actionEnergy),
    surface: input.surface,
    format: input.format,
    seed
  });
  const session = await prisma.interactiveMatchSession.create({
    data: {
      playerAId: input.playerA.id,
      playerBId: input.playerB.id,
      type: input.type,
      surface: input.surface,
      format: input.format,
      state: encodeJson(state)
    },
    include: interactiveSessionInclude
  });
  return { created: true, session: publicInteractiveMatchSession(session) };
}

function completedReplayPayload(
  sessionId: string,
  state: InteractiveMatchState,
  finalStatus: "FINISHED" | "ABANDONED"
) {
  return {
    version: 2,
    interactiveSessionId: sessionId,
    abandoned: finalStatus === "ABANDONED",
    events: state.events,
    momentum: state.events.map((event) => event.momentum),
    finalScore: state.events.at(-1)?.score ?? null,
    coachingHistory: state.coachingHistory,
    finalEnergy: state.energy,
    finalConfidence: state.confidence,
    winnerId: state.winnerId,
    scoreText: state.scoreText,
    surface: state.surface,
    format: state.format
  };
}

async function saveProgress(session: InteractiveSessionWithPlayers, state: InteractiveMatchState) {
  const claimed = await prisma.interactiveMatchSession.updateMany({
    where: { id: session.id, revision: session.revision, status: "ACTIVE" },
    data: {
      state: encodeJson(state),
      revision: { increment: 1 }
    }
  });
  if (claimed.count !== 1) {
    throw new InteractiveMatchSessionError(
      "Le match a déjà progressé sur un autre appareil. Rechargez la session.",
      409
    );
  }
  return prisma.interactiveMatchSession.findUniqueOrThrow({
    where: { id: session.id },
    include: interactiveSessionInclude
  });
}

async function finishSession(
  session: InteractiveSessionWithPlayers,
  state: InteractiveMatchState,
  finalStatus: "FINISHED" | "ABANDONED" = "FINISHED"
) {
  const winnerId = state.winnerId;
  if (!winnerId) throw new Error("Vainqueur du match interactif introuvable.");
  const loserId = winnerId === session.playerAId ? session.playerBId : session.playerAId;
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.interactiveMatchSession.updateMany({
      where: { id: session.id, revision: session.revision, status: "ACTIVE" },
      data: { status: "COMPLETING", revision: { increment: 1 } }
    });
    if (claimed.count !== 1) {
      throw new InteractiveMatchSessionError(
        "Le match a déjà été terminé ou mis à jour sur un autre appareil.",
        409
      );
    }
    const match = await persistServerMatchOutcome(tx, {
      playerA: session.playerA,
      playerB: session.playerB,
      type: session.type,
      replay: {
        winnerId,
        loserId,
        surface: state.surface,
        format: state.format,
        scoreText: state.scoreText,
        durationMinutes:
          finalStatus === "ABANDONED"
            ? Math.max(1, Math.round(state.events.length * 0.65))
            : Math.max(28, Math.round(state.events.length * 0.65))
      },
      replayPayload: completedReplayPayload(session.id, state, finalStatus)
    });
    return tx.interactiveMatchSession.update({
      where: { id: session.id },
      data: {
        state: encodeJson(state),
        status: finalStatus,
        completedMatchId: match.id,
        completedAt: new Date()
      },
      include: interactiveSessionInclude
    });
  });
}

export async function coachInteractiveMatchSession(input: {
  sessionId: string;
  userId: string;
  revision: number;
  instructionId: string | null;
}) {
  const session = await ownedSession(input.sessionId, input.userId);
  if (session.status !== "ACTIVE") {
    if (session.status === "FINISHED") return publicInteractiveMatchSession(session);
    throw new InteractiveMatchSessionError("Cette session de match n'est plus active.", 409);
  }
  if (session.revision !== input.revision) {
    throw new InteractiveMatchSessionError(
      "Le match a déjà progressé. Rechargez la session avant de continuer.",
      409
    );
  }
  const instructionId = input.instructionId;
  if (instructionId !== null && !isInstructionId(instructionId)) {
    throw new InteractiveMatchSessionError("Consigne de coaching invalide.", 400);
  }

  const state = decodeJson<InteractiveMatchState>(session.state);
  const instructed = applyCoachingDecision(state, instructionId);
  const advanced = advanceInteractiveMatch(instructed);
  const updated =
    advanced.status === "FINISHED"
      ? await finishSession(session, advanced)
      : await saveProgress(session, advanced);
  return publicInteractiveMatchSession(updated);
}

export async function abandonInteractiveMatchSession(input: {
  sessionId: string;
  userId: string;
  revision: number;
}) {
  const session = await ownedSession(input.sessionId, input.userId);
  if (session.status !== "ACTIVE") return publicInteractiveMatchSession(session);
  if (session.revision !== input.revision) {
    throw new InteractiveMatchSessionError(
      "Le match a déjà progressé. Rechargez la session avant de l'abandonner.",
      409
    );
  }
  const state = decodeJson<InteractiveMatchState>(session.state);
  state.status = "FINISHED";
  state.winnerId = session.playerBId;
  state.coachWindow = null;
  state.scoreText = `${state.scoreText || "0-0"} (ab.)`;
  return publicInteractiveMatchSession(await finishSession(session, state, "ABANDONED"));
}

export async function saveInteractiveMatchFeedback(input: {
  sessionId: string;
  userId: string;
  balance: "TOO_EASY" | "BALANCED" | "TOO_HARD";
  enjoyment?: number;
  viewport: "MOBILE_LANDSCAPE" | "DESKTOP" | "OTHER";
  comment: string;
}) {
  const session = await ownedSession(input.sessionId, input.userId);
  if (!session.completedAt || !["FINISHED", "ABANDONED"].includes(session.status)) {
    throw new InteractiveMatchSessionError(
      "Le retour d'expérience sera disponible à la fin du match.",
      409
    );
  }
  const feedback = await prisma.interactiveMatchFeedback.upsert({
    where: { sessionId: session.id },
    create: {
      sessionId: session.id,
      playerId: session.playerAId,
      balance: input.balance,
      enjoyment: input.enjoyment ?? null,
      viewport: input.viewport,
      comment: input.comment
    },
    update: {
      balance: input.balance,
      ...(input.enjoyment !== undefined ? { enjoyment: input.enjoyment } : {}),
      viewport: input.viewport,
      comment: input.comment
    }
  });
  return {
    id: feedback.id,
    balance: feedback.balance,
    enjoyment: feedback.enjoyment,
    viewport: feedback.viewport,
    comment: feedback.comment,
    updatedAt: feedback.updatedAt.toISOString()
  };
}
