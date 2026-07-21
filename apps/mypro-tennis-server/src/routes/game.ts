import { Router } from "express";
import { prisma } from "@mypro/database";
import { calculateOverall } from "@mypro/core";
import {
  challengeSchema,
  coachCardVariantSelectionSchema,
  coachDeckSaveSchema,
  cosmeticEquipSchema,
  cosmeticMarketSchema,
  interactiveCoachingDecisionSchema,
  interactiveCoachCardDecisionSchema,
  interactiveMatchAbandonSchema,
  interactiveMatchFeedbackSchema,
  matchRequestSchema,
  skillUpgradeSchema
} from "@mypro/shared";
import {
  createStatsForArchetype,
  fftRankingPath,
  type FftRanking,
  type TennisStats
} from "@mypro/sports-tennis";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { spendCareerAction } from "../services/actionEnergy";
import {
  CoachDeckError,
  activateCoachDeck,
  createCoachDeck,
  getCoachDeckState,
  getCoachDeckSnapshot,
  selectCoachCardVariant,
  updateCoachDeck
} from "../services/coachDecks";
import {
  chestPublicCatalog,
  getChestState,
  openChest,
  speedUpChest,
  unlockStatCardBonus
} from "../services/chests";
import {
  exchangeCosmeticsOnMarket,
  equipCosmetic,
  unequipCosmetic,
  upgradeCosmetic
} from "../services/equipment";
import { createServerMatch } from "../services/matches";
import {
  DUEL_POOL_SIZE,
  duelOverallRange,
  duelPoolSlotIsValid,
  isWithinDuelOverallRange,
  orderDuelPoolCandidates,
  type DuelCandidateHistory
} from "../services/duelPool";
import {
  InteractiveMatchSessionError,
  abandonInteractiveMatchSession,
  coachInteractiveMatchSession,
  createInteractiveMatchSession,
  getActiveInteractiveMatchSession,
  getInteractiveMatchSession,
  playCoachDeckCardSession,
  saveInteractiveMatchFeedback
} from "../services/interactiveMatches";
import { publicPlayer } from "../services/playerMapper";
import { getPlayerSkillState, spendSkillPoint } from "../services/playerProgression";
import { decodeJson, encodeJson } from "../services/json";
import { DAY_MS, seasonWindow } from "../services/seasons";
import { claimTodaySeasonReward, getSeasonDailyRewardState } from "../services/seasonRewards";

export const gameRouter = Router();

const archetypes = [
  "Gros service",
  "Relanceur",
  "Frappeur de fond",
  "Athlète endurant",
  "Joueur complet"
];
const personalPictureIds = [
  "pp-01",
  "pp-02",
  "pp-03",
  "pp-04",
  "pp-05",
  "pp-06",
  "pp-07",
  "pp-08",
  "pp-09",
  "pp-10"
] as const;
const aiFirstNames = [
  "Alex",
  "Noa",
  "Lina",
  "Sacha",
  "Iris",
  "Malo",
  "Nora",
  "Eden",
  "Leon",
  "Mila",
  "Oscar",
  "Zoe"
];
const aiLastNames = [
  "Nova",
  "Silva",
  "Kovac",
  "Marin",
  "Ishi",
  "Serrano",
  "Delaune",
  "Okafor",
  "Masse",
  "Berg",
  "Mercier",
  "Noval"
];

function aiIdentity(seed: number) {
  return {
    firstName: aiFirstNames[Math.abs(seed) % aiFirstNames.length] ?? "Alex",
    lastName: aiLastNames[Math.abs(seed * 7 + 3) % aiLastNames.length] ?? "Nova"
  };
}

function avatarForIdentity(identity: { firstName: string; lastName: string }, seed: number) {
  const initials = `${identity.firstName[0] ?? "M"}${identity.lastName[0] ?? "P"}`.toUpperCase();
  const pictureId = personalPictureIds[Math.abs(seed) % personalPictureIds.length] ?? "pp-01";
  return encodeJson({
    type: "picture-v1",
    initials,
    picture: { kind: "preset", id: pictureId }
  });
}

type SeasonCompetitionType = "daily" | "weekly" | "individual";

type SeasonDefinition = {
  type: SeasonCompetitionType;
  title: string;
  subtitle: string;
  energyCost: number;
  entryFeeBase: number;
  cashPrizeBase: number;
  frequency: string;
  drawSize: number;
  bestOffset: number;
  worstOffset: number;
  surface: "Dur" | "Terre battue" | "Gazon" | "Indoor";
};

const seasonDefinitions: Record<SeasonCompetitionType, SeasonDefinition> = {
  daily: {
    type: "daily",
    title: "Tournoi journalier",
    subtitle: "Tableau de 16 joueurs, disponible une fois par jour réel.",
    energyCost: 1,
    entryFeeBase: 40,
    cashPrizeBase: 180,
    frequency: "1 fois par jour",
    drawSize: 16,
    bestOffset: 2,
    worstOffset: -2,
    surface: "Dur"
  },
  weekly: {
    type: "weekly",
    title: "Tournoi hebdomadaire",
    subtitle: "Tableau de 16 joueurs, disponible une fois par semaine réelle.",
    energyCost: 2,
    entryFeeBase: 80,
    cashPrizeBase: 420,
    frequency: "1 fois par semaine",
    drawSize: 16,
    bestOffset: 3,
    worstOffset: -2,
    surface: "Terre battue"
  },
  individual: {
    type: "individual",
    title: "Championnat individuel",
    subtitle: "Parcours pyramidal FFT de votre classement jusqu'à -15. Une défaite élimine.",
    energyCost: 3,
    entryFeeBase: 120,
    cashPrizeBase: 900,
    frequency: "1 fois par saison",
    drawSize: 0,
    bestOffset: 99,
    worstOffset: 0,
    surface: "Indoor"
  }
};

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

function seasonEconomyForRanking(definition: SeasonDefinition, playerRanking: string) {
  const rankingIndex = Math.max(0, fftRankingPath.indexOf(playerRanking as FftRanking));
  const progression = rankingIndex / Math.max(1, fftRankingPath.length - 1);
  const economyPower = 1 + progression * 4.4;
  const entryFee = roundToTen(definition.entryFeeBase * economyPower);
  const cashMultiplier =
    definition.type === "individual" ? 3.2 : definition.type === "weekly" ? 2.45 : 2.05;
  const cashPrize = roundToTen(definition.cashPrizeBase * economyPower * cashMultiplier);
  return { entryFee, cashPrize };
}

function periodKey(
  type: SeasonCompetitionType,
  seasonKey: string,
  window: ReturnType<typeof seasonWindow>
) {
  if (type === "daily") return `${seasonKey}-jour-${window.day}`;
  if (type === "weekly") return `${seasonKey}-semaine-${window.week}`;
  return seasonKey;
}

function nextPlayableAt(type: SeasonCompetitionType, window: ReturnType<typeof seasonWindow>) {
  if (type === "daily")
    return new Date(
      Math.min(window.startsAt.getTime() + window.day * DAY_MS, window.endsAt.getTime())
    );
  if (type === "weekly")
    return new Date(
      Math.min(window.startsAt.getTime() + window.week * 7 * DAY_MS, window.endsAt.getTime())
    );
  return window.endsAt;
}

function isInSeasonWindow(
  date: Date,
  window: Pick<ReturnType<typeof seasonWindow>, "startsAt" | "endsAt">
) {
  const timestamp = date.getTime();
  return timestamp >= window.startsAt.getTime() && timestamp < window.endsAt.getTime();
}

function clampRankingIndex(index: number) {
  return Math.max(0, Math.min(fftRankingPath.length - 1, index));
}

function targetOverallForRanking(
  _playerOverall: number,
  playerRanking: string,
  targetRanking: FftRanking
) {
  const playerIndex = Math.max(0, fftRankingPath.indexOf(playerRanking as FftRanking));
  const targetIndex = Math.max(0, fftRankingPath.indexOf(targetRanking));
  const rankingDelta = targetIndex - playerIndex;
  const ratio = targetIndex / Math.max(1, fftRankingPath.length - 1);
  const base = Math.round(ratio * 92);
  const localVariance = rankingDelta === 0 ? 0 : rankingDelta > 0 ? 2 : -2;
  return Math.max(0, Math.min(94, base + localVariance));
}

function tunedStatsForOverall(overall: number, seed: number) {
  const base = createStatsForArchetype(archetypes[seed % archetypes.length] ?? "Joueur complet");
  const currentOverall = calculateOverall(base);
  const diff = overall - currentOverall;
  const tuned = Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      Math.max(0, Math.min(92, Math.round(value + diff)))
    ])
  ) as TennisStats;
  return tuned;
}

async function getOrCreateSeasonOpponent(
  targetRanking: FftRanking,
  targetOverall: number,
  seed: number,
  excludePlayerId: string,
  options: { excludeDailyLimitedRealOpponents?: boolean } = {}
) {
  const excludedIds = [
    excludePlayerId,
    ...(options.excludeDailyLimitedRealOpponents
      ? Array.from(await realOpponentIdsAtDailyLimit(excludePlayerId))
      : [])
  ];
  const realPlayers = await prisma.player.findMany({
    where: {
      id: { notIn: excludedIds },
      isAi: false,
      fftRanking: targetRanking,
      overall: { gte: targetOverall - 8, lte: targetOverall + 8 }
    },
    orderBy: { id: "asc" },
    take: 24
  });
  const realPlayer = realPlayers[Math.abs(seed) % Math.max(1, realPlayers.length)];
  if (realPlayer) return realPlayer;
  const identity = aiIdentity(seed);
  const existing = await prisma.player.findFirst({
    where: {
      isAi: true,
      firstName: identity.firstName,
      lastName: identity.lastName,
      fftRanking: targetRanking,
      overall: { gte: targetOverall - 3, lte: targetOverall + 3 }
    },
    orderBy: { id: "asc" }
  });
  if (existing) return existing;
  const stats = tunedStatsForOverall(targetOverall, seed);
  return prisma.player.create({
    data: {
      firstName: identity.firstName,
      lastName: identity.lastName,
      nationality: "FR",
      gender: "Homme",
      dominantHand: seed % 2 === 0 ? "Droite" : "Gauche",
      backhand: seed % 3 === 0 ? "Une main" : "Deux mains",
      archetype: archetypes[seed % archetypes.length] ?? "Joueur complet",
      avatar: avatarForIdentity(identity, seed),
      isAi: true,
      stats: encodeJson(stats),
      overall: calculateOverall(stats),
      fftRanking: targetRanking,
      amateurPoints: targetOverall * 18,
      rankingPoints: targetOverall * 22,
      worldRank: 500 + seed
    }
  });
}

function seasonOpponentSeed(entryId: string, currentRound: number) {
  return Math.floor(seededRatio(`${entryId}-${currentRound}`) * 1_000_000);
}

function duelPoolSeed(player: { id: string; wins: number; losses: number; fftRanking: string }) {
  return `${player.id}-${player.fftRanking}-${player.wins}-${player.losses}`;
}

async function getOrCreateDuelAiOpponent(params: {
  player: { id: string; fftRanking: string; overall: number };
  seed: string;
  slot: number;
  excludedIds: string[];
}) {
  const seedNumber = Math.floor(seededRatio(`${params.seed}-${params.slot}`) * 100_000);
  const range = duelOverallRange(params.player.overall);
  const targetOverall = range.min + (seedNumber % Math.max(1, range.max - range.min + 1));
  const identity = aiIdentity(seedNumber + params.slot);
  const existing = await prisma.player.findFirst({
    where: {
      id: { notIn: [params.player.id, ...params.excludedIds] },
      isAi: true,
      firstName: identity.firstName,
      lastName: identity.lastName,
      overall: { gte: range.min, lte: range.max }
    }
  });
  if (existing) return existing;
  const stats = tunedStatsForOverall(targetOverall, seedNumber);
  return prisma.player.create({
    data: {
      firstName: identity.firstName,
      lastName: identity.lastName,
      nationality: ["FR", "BE", "CH", "ES", "IT"][params.slot % 5] ?? "FR",
      gender: "Homme",
      dominantHand: seedNumber % 2 === 0 ? "Droite" : "Gauche",
      backhand: seedNumber % 3 === 0 ? "Une main" : "Deux mains",
      archetype: archetypes[seedNumber % archetypes.length] ?? "Joueur complet",
      avatar: avatarForIdentity(identity, seedNumber + params.slot),
      isAi: true,
      stats: encodeJson(stats),
      overall: calculateOverall(stats),
      fftRanking: params.player.fftRanking,
      amateurPoints: targetOverall * 18,
      rankingPoints: targetOverall * 22,
      worldRank: 600 + seedNumber
    }
  });
}

async function duelCandidateHistory(playerId: string, opponentIds: string[]) {
  const history = new Map<string, DuelCandidateHistory>();
  if (!opponentIds.length) return history;
  const matches = await prisma.match.findMany({
    where: {
      type: { startsWith: "Duel" },
      OR: [
        { playerAId: playerId, playerBId: { in: opponentIds } },
        { playerBId: playerId, playerAId: { in: opponentIds } }
      ]
    },
    select: { playerAId: true, playerBId: true, playedAt: true },
    orderBy: { playedAt: "desc" }
  });
  for (const match of matches) {
    const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;
    const current = history.get(opponentId);
    history.set(opponentId, {
      count: (current?.count ?? 0) + 1,
      lastPlayedAt: current?.lastPlayedAt ?? match.playedAt
    });
  }
  return history;
}

async function buildDuelPool(player: {
  id: string;
  fftRanking: string;
  overall: number;
  wins: number;
  losses: number;
}) {
  const range = duelOverallRange(player.overall);
  const seed = duelPoolSeed(player);
  const [dailyLimitedRealOpponentIds, existingSlots] = await Promise.all([
    realOpponentIdsAtDailyLimit(player.id),
    prisma.duelPoolSlot.findMany({
      where: { playerId: player.id },
      include: { opponent: true },
      orderBy: { slotIndex: "asc" }
    })
  ]);
  const earliestAssignment = existingSlots.reduce<Date | null>(
    (earliest, slot) => (!earliest || slot.assignedAt < earliest ? slot.assignedAt : earliest),
    null
  );
  const matchesSinceAssignment = earliestAssignment
    ? await prisma.match.findMany({
        where: {
          type: { startsWith: "Duel" },
          playedAt: { gte: earliestAssignment },
          OR: [{ playerAId: player.id }, { playerBId: player.id }]
        },
        select: { playerAId: true, playerBId: true, playedAt: true },
        orderBy: { playedAt: "desc" }
      })
    : [];
  const lastDuelByOpponent = new Map<string, Date>();
  for (const match of matchesSinceAssignment) {
    const opponentId = match.playerAId === player.id ? match.playerBId : match.playerAId;
    if (!lastDuelByOpponent.has(opponentId)) lastDuelByOpponent.set(opponentId, match.playedAt);
  }

  const slotsByIndex = new Map<number, (typeof existingSlots)[number]["opponent"]>();
  const occupiedOpponentIds = new Set<string>();
  const blockedForThisRefresh = new Set<string>();
  const invalidSlotIds: string[] = [];
  for (const slot of existingSlots) {
    const lastDuel = lastDuelByOpponent.get(slot.opponentId);
    const duplicate =
      slot.slotIndex < 0 ||
      slot.slotIndex >= DUEL_POOL_SIZE ||
      slotsByIndex.has(slot.slotIndex) ||
      occupiedOpponentIds.has(slot.opponentId);
    const valid =
      !duplicate &&
      slot.opponentId !== player.id &&
      duelPoolSlotIsValid({
        playerOverall: player.overall,
        opponentOverall: slot.opponent.overall,
        dailyLimitReached: !slot.opponent.isAi && dailyLimitedRealOpponentIds.has(slot.opponentId),
        playedSinceAssigned: Boolean(lastDuel && lastDuel >= slot.assignedAt)
      });
    if (!valid) {
      invalidSlotIds.push(slot.id);
      blockedForThisRefresh.add(slot.opponentId);
      continue;
    }
    slotsByIndex.set(slot.slotIndex, slot.opponent);
    occupiedOpponentIds.add(slot.opponentId);
  }
  if (invalidSlotIds.length) {
    await prisma.duelPoolSlot.deleteMany({ where: { id: { in: invalidSlotIds } } });
  }

  if (slotsByIndex.size === DUEL_POOL_SIZE) {
    return Array.from({ length: DUEL_POOL_SIZE }, (_, slotIndex) =>
      slotsByIndex.get(slotIndex)
    ).filter((opponent): opponent is NonNullable<typeof opponent> => Boolean(opponent));
  }

  const excludedIds = [
    player.id,
    ...dailyLimitedRealOpponentIds,
    ...occupiedOpponentIds,
    ...blockedForThisRefresh
  ];
  const candidates = await prisma.player.findMany({
    where: {
      id: { notIn: excludedIds },
      overall: { gte: range.min, lte: range.max }
    }
  });
  const candidateHistory = await duelCandidateHistory(
    player.id,
    candidates.map((candidate) => candidate.id)
  );
  const orderedCandidates = orderDuelPoolCandidates(candidates, candidateHistory, seed);

  for (let slotIndex = 0; slotIndex < DUEL_POOL_SIZE; slotIndex += 1) {
    if (slotsByIndex.has(slotIndex)) continue;
    let opponent = orderedCandidates.shift();
    let attempt = 0;
    while (!opponent && attempt < 12) {
      opponent = await getOrCreateDuelAiOpponent({
        player,
        seed: `${seed}-${attempt}`,
        slot: slotIndex,
        excludedIds: [...occupiedOpponentIds, ...blockedForThisRefresh]
      });
      if (occupiedOpponentIds.has(opponent.id) || blockedForThisRefresh.has(opponent.id)) {
        opponent = undefined;
        attempt += 1;
      }
    }
    if (!opponent) continue;
    const assignedAt = new Date();
    await prisma.duelPoolSlot.upsert({
      where: { playerId_slotIndex: { playerId: player.id, slotIndex } },
      update: { opponentId: opponent.id, assignedAt },
      create: { playerId: player.id, opponentId: opponent.id, slotIndex, assignedAt }
    });
    slotsByIndex.set(slotIndex, opponent);
    occupiedOpponentIds.add(opponent.id);
  }
  return Array.from({ length: DUEL_POOL_SIZE }, (_, slotIndex) =>
    slotsByIndex.get(slotIndex)
  ).filter((opponent): opponent is NonNullable<typeof opponent> => Boolean(opponent));
}

function todayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function realOpponentMatchCountToday(playerId: string, opponentId: string) {
  const { start, end } = todayBounds();
  return prisma.match.count({
    where: {
      type: { startsWith: "Duel" },
      playedAt: { gte: start, lt: end },
      OR: [
        { playerAId: playerId, playerBId: opponentId },
        { playerAId: opponentId, playerBId: playerId }
      ]
    }
  });
}

async function realOpponentIdsAtDailyLimit(playerId: string) {
  const { start, end } = todayBounds();
  const matches = await prisma.match.findMany({
    where: {
      type: { startsWith: "Duel" },
      playedAt: { gte: start, lt: end },
      OR: [{ playerAId: playerId }, { playerBId: playerId }]
    },
    select: {
      playerAId: true,
      playerBId: true,
      playerA: { select: { isAi: true } },
      playerB: { select: { isAi: true } }
    }
  });
  const counts = new Map<string, number>();
  for (const match of matches) {
    const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;
    const opponentIsAi = match.playerAId === playerId ? match.playerB.isAi : match.playerA.isAi;
    if (opponentIsAi) continue;
    counts.set(opponentId, (counts.get(opponentId) ?? 0) + 1);
  }
  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .map(([opponentId]) => opponentId)
  );
}

function buildSeasonBracket(
  type: SeasonCompetitionType,
  player: { fftRanking: string; overall: number }
) {
  const definition = seasonDefinitions[type];
  if (type === "individual") {
    const path = fftRankingPath.map((ranking, index) => ({
      round: index + 1,
      ranking,
      label:
        ranking === "-15" ? "Finale nationale -15" : `Tour ${index + 1} - adversaire ${ranking}`,
      targetOverall: targetOverallForRanking(player.overall, player.fftRanking, ranking)
    }));
    return { mode: "pyramide", path };
  }
  const current = Math.max(0, fftRankingPath.indexOf(player.fftRanking as FftRanking));
  const worst = clampRankingIndex(current + definition.worstOffset);
  const best = clampRankingIndex(current + definition.bestOffset);
  const rankings = Array.from({ length: 15 }, (_, index) => {
    const ratio = index / 14;
    return fftRankingPath[Math.round(worst + ratio * (best - worst))] ?? "NC";
  });
  const bracket: TournamentBracketState = {
    mode: "tableau-16",
    range: {
      best: fftRankingPath[best] ?? "NC",
      worst: fftRankingPath[worst] ?? "NC"
    },
    opponents: rankings.map((ranking, index) => ({
      seed: index + 1,
      round: Math.min(4, Math.floor(index / 4) + 1),
      ranking,
      targetOverall: targetOverallForRanking(player.overall, player.fftRanking, ranking)
    }))
  };
  return ensureTournamentTree({
    bracket,
    playerRanking: player.fftRanking,
    playerOverall: player.overall
  });
}

function nextSeasonOpponent(entry: {
  competitionType: string;
  currentRound: number;
  bracket: string;
}) {
  const bracket = decodeJson<{
    mode: string;
    path?: Array<{ ranking: FftRanking; targetOverall: number }>;
    opponents?: Array<{ ranking: FftRanking; targetOverall: number }>;
    rounds?: TournamentTreeRound[];
  }>(entry.bracket);
  if (entry.competitionType === "individual") return bracket.path?.[entry.currentRound] ?? null;
  return (
    findNextTournamentOpponent(bracket, entry.currentRound) ??
    [...(bracket.opponents ?? [])].sort((a, b) => a.targetOverall - b.targetOverall)[
      entry.currentRound
    ] ??
    null
  );
}

type TournamentParticipant = {
  label: string;
  ranking: string;
  targetOverall: number;
  isPlayer?: boolean;
};

type TournamentTreeMatch = {
  left: TournamentParticipant | null;
  right: TournamentParticipant | null;
  winner: TournamentParticipant | null;
  scoreText?: string;
  playedByPlayer?: boolean;
  replayMatchId?: string;
};

type TournamentTreeRound = {
  name: string;
  matches: TournamentTreeMatch[];
};

type TournamentBracketState = {
  mode: string;
  range?: { best?: string; worst?: string };
  opponents?: Array<{ seed?: number; ranking: string; targetOverall?: number }>;
  rounds?: TournamentTreeRound[];
  completedTournament?: {
    status: string;
    winnerName: string;
    winnerRanking: string;
    finishedAt: string;
    rounds: Array<{
      name: string;
      matches: Array<{
        leftLabel: string;
        leftRanking: string;
        rightLabel: string;
        rightRanking: string;
        winnerLabel: string;
        winnerRanking: string;
        scoreText: string;
        playedByPlayer: boolean;
      }>;
    }>;
  };
};

function seededRatio(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function tournamentScore(roundIndex: number, tightness: number) {
  if (tightness > 0.82) return roundIndex % 2 === 0 ? "7-6 4-6 10-8" : "6-4 7-6";
  if (tightness > 0.62) return roundIndex % 2 === 0 ? "6-4 3-6 10-7" : "7-5 6-4";
  return roundIndex % 2 === 0 ? "6-3 6-2" : "6-2 6-4";
}

function pickTournamentWinner(
  left: TournamentParticipant,
  right: TournamentParticipant,
  seed: string
) {
  const ratingGap = left.targetOverall - right.targetOverall;
  const chanceLeft = Math.max(0.18, Math.min(0.82, 0.5 + ratingGap * 0.035));
  return seededRatio(seed) <= chanceLeft ? left : right;
}

const tournamentRoundNames = ["Huitièmes", "Quarts", "Demi-finales", "Finale"];

function tournamentParticipants(params: {
  bracket: TournamentBracketState;
  playerRanking: string;
  playerOverall: number;
}) {
  const opponents = [...(params.bracket.opponents ?? [])]
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
    .map((opponent) => ({
      label: `T${opponent.seed ?? "?"}`,
      ranking: opponent.ranking,
      targetOverall:
        opponent.targetOverall ??
        targetOverallForRanking(
          params.playerOverall,
          params.playerRanking,
          opponent.ranking as FftRanking
        )
    }));
  return [
    {
      label: "Vous",
      ranking: params.playerRanking,
      targetOverall: params.playerOverall,
      isPlayer: true
    },
    ...opponents
  ].slice(0, 16);
}

function initialTournamentRounds(participants: TournamentParticipant[]): TournamentTreeRound[] {
  return tournamentRoundNames.map((name, roundIndex) => {
    const matchCount = Math.max(1, 8 / 2 ** roundIndex);
    return {
      name,
      matches: Array.from({ length: matchCount }, (_, matchIndex) => {
        if (roundIndex === 0) {
          return {
            left: participants[matchIndex * 2] ?? null,
            right: participants[matchIndex * 2 + 1] ?? null,
            winner: null
          };
        }
        return { left: null, right: null, winner: null };
      })
    };
  });
}

function ensureTournamentTree(params: {
  bracket: TournamentBracketState;
  playerRanking: string;
  playerOverall: number;
}) {
  if (params.bracket.mode !== "tableau-16") return params.bracket;
  if (params.bracket.rounds?.length) return params.bracket;
  return {
    ...params.bracket,
    rounds: initialTournamentRounds(
      tournamentParticipants({
        bracket: params.bracket,
        playerRanking: params.playerRanking,
        playerOverall: params.playerOverall
      })
    )
  };
}

function publicCompletedTournament(rounds: TournamentTreeRound[], champion: TournamentParticipant) {
  return {
    status: "TERMINE",
    winnerName: champion.label,
    winnerRanking: champion.ranking,
    finishedAt: new Date().toISOString(),
    rounds: rounds.map((round) => ({
      name: round.name,
      matches: round.matches
        .filter((match) => match.left && match.right && match.winner)
        .map((match) => ({
          leftLabel: match.left!.label,
          leftRanking: match.left!.ranking,
          rightLabel: match.right!.label,
          rightRanking: match.right!.ranking,
          winnerLabel: match.winner!.label,
          winnerRanking: match.winner!.ranking,
          scoreText: match.scoreText ?? "Score simulé",
          playedByPlayer: Boolean(match.playedByPlayer)
        }))
    }))
  };
}

function advanceTournamentWinners(rounds: TournamentTreeRound[], roundIndex: number) {
  const nextRound = rounds[roundIndex + 1];
  if (!nextRound) return;
  const winners = rounds[roundIndex]?.matches.map((match) => match.winner).filter(Boolean) ?? [];
  nextRound.matches = nextRound.matches.map((match, matchIndex) => ({
    ...match,
    left: winners[matchIndex * 2] ?? null,
    right: winners[matchIndex * 2 + 1] ?? null,
    winner: null,
    playedByPlayer: false
  }));
}

function playTournamentRound(params: {
  bracket: TournamentBracketState;
  roundIndex: number;
  playerRanking: string;
  playerOverall: number;
  playerWon?: boolean;
  playerMatchId?: string;
  entryId: string;
}) {
  const bracket = ensureTournamentTree({
    bracket: params.bracket,
    playerRanking: params.playerRanking,
    playerOverall: params.playerOverall
  });
  if (bracket.mode !== "tableau-16" || bracket.completedTournament || !bracket.rounds)
    return bracket;
  const rounds = bracket.rounds;
  const round = rounds[params.roundIndex];
  if (!round) return bracket;
  for (const [matchIndex, match] of round.matches.entries()) {
    const left = match.left;
    const right = match.right;
    if (match.winner) continue;
    if (!left || !right) continue;
    const playerMatch = Boolean(left.isPlayer || right.isPlayer);
    let winner: TournamentParticipant;
    if (playerMatch) {
      const player = left.isPlayer ? left : right;
      const opponent = left.isPlayer ? right : left;
      winner = params.playerWon ? player : opponent;
      if (params.playerMatchId) match.replayMatchId = params.playerMatchId;
      match.scoreText = params.playerWon ? "Victoire joueur" : "Défaite joueur";
      match.playedByPlayer = true;
    } else {
      winner = pickTournamentWinner(
        left,
        right,
        `${params.entryId}-${params.roundIndex}-${matchIndex}`
      );
      const tightness =
        Math.abs(left.targetOverall - right.targetOverall) < 4
          ? 0.85
          : seededRatio(`${params.entryId}-score-${params.roundIndex}-${matchIndex}`);
      match.scoreText = tournamentScore(params.roundIndex, tightness);
      match.playedByPlayer = false;
    }
    match.winner = winner;
  }
  advanceTournamentWinners(rounds, params.roundIndex);
  const champion = rounds.at(-1)?.matches[0]?.winner;
  return champion
    ? {
        ...bracket,
        rounds,
        completedTournament: publicCompletedTournament(rounds, champion)
      }
    : { ...bracket, rounds };
}

function completeTournamentFromRound(params: {
  bracket: TournamentBracketState;
  fromRound: number;
  playerRanking: string;
  playerOverall: number;
  entryId: string;
}) {
  const bracket = ensureTournamentTree({
    bracket: params.bracket,
    playerRanking: params.playerRanking,
    playerOverall: params.playerOverall
  });
  if (bracket.mode !== "tableau-16" || bracket.completedTournament || !bracket.rounds)
    return bracket;
  for (
    let roundIndex = params.fromRound;
    roundIndex < tournamentRoundNames.length;
    roundIndex += 1
  ) {
    const round = bracket.rounds[roundIndex];
    if (!round) continue;
    for (const [matchIndex, match] of round.matches.entries()) {
      const left = match.left;
      const right = match.right;
      if (match.winner || !left || !right) continue;
      const winner = pickTournamentWinner(
        left,
        right,
        `${params.entryId}-finish-${roundIndex}-${matchIndex}`
      );
      const tightness =
        Math.abs(left.targetOverall - right.targetOverall) < 4
          ? 0.85
          : seededRatio(`${params.entryId}-finish-score-${roundIndex}-${matchIndex}`);
      match.winner = winner;
      match.scoreText = tournamentScore(roundIndex, tightness);
      match.playedByPlayer = Boolean(left.isPlayer || right.isPlayer);
    }
    advanceTournamentWinners(bracket.rounds, roundIndex);
  }
  const champion = bracket.rounds.at(-1)?.matches[0]?.winner;
  return champion
    ? {
        ...bracket,
        completedTournament: publicCompletedTournament(bracket.rounds, champion)
      }
    : bracket;
}

function findNextTournamentOpponent(bracket: TournamentBracketState, currentRound: number) {
  const round = bracket.rounds?.[currentRound];
  const match = round?.matches.find((item) => Boolean(item.left?.isPlayer || item.right?.isPlayer));
  if (!match || match.winner) return null;
  const opponent = match.left?.isPlayer ? match.right : match.left;
  return opponent
    ? { ranking: opponent.ranking as FftRanking, targetOverall: opponent.targetOverall }
    : null;
}

function replayTournamentProgressForDisplay(params: {
  bracket: TournamentBracketState;
  playerRanking: string;
  playerOverall: number;
  entryId: string;
  matches: Array<{ matchId: string; won: boolean }>;
}) {
  if (params.bracket.mode !== "tableau-16") return params.bracket;
  let bracket = ensureTournamentTree({
    bracket: params.bracket,
    playerRanking: params.playerRanking,
    playerOverall: params.playerOverall
  });
  if (params.bracket.rounds?.some((round) => round.matches.some((match) => match.winner)))
    return bracket;
  for (const [roundIndex, match] of params.matches.entries()) {
    bracket = playTournamentRound({
      bracket,
      roundIndex,
      playerRanking: params.playerRanking,
      playerOverall: params.playerOverall,
      playerWon: match.won,
      playerMatchId: match.matchId,
      entryId: params.entryId
    });
    if (!match.won) {
      bracket = completeTournamentFromRound({
        bracket,
        fromRound: roundIndex + 1,
        playerRanking: params.playerRanking,
        playerOverall: params.playerOverall,
        entryId: params.entryId
      });
      break;
    }
  }
  return bracket;
}

gameRouter.get("/rankings", async (_request, response) => {
  const players = await prisma.player.findMany({
    orderBy: [{ rankingPoints: "desc" }, { overall: "desc" }],
    take: 100
  });
  return response.json(
    players.map((player, index) => ({ ...publicPlayer(player), rank: index + 1 }))
  );
});

gameRouter.get("/coach-decks", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  try {
    return response.json(await getCoachDeckState(player));
  } catch (error) {
    console.error("Initialisation du Coach Deck impossible", error);
    return response.status(503).json({
      message:
        "Votre deck de départ n’a pas pu être préparé. Réessayez après le redémarrage du serveur."
    });
  }
});

gameRouter.put(
  "/coach-cards/:cardId/variant",
  requireAuth,
  validateBody(coachCardVariantSelectionSchema),
  async (request, response) => {
    const cardId = request.params.cardId;
    if (!cardId) return response.status(400).json({ message: "Identifiant de carte requis." });
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    try {
      return response.json(await selectCoachCardVariant(player, cardId, request.body.variantId));
    } catch (error) {
      if (error instanceof CoachDeckError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      return response.status(500).json({ message: "Sélection de variante impossible." });
    }
  }
);

gameRouter.post(
  "/coach-decks",
  requireAuth,
  validateBody(coachDeckSaveSchema),
  async (request, response) => {
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    try {
      return response.status(201).json(
        await createCoachDeck({
          player,
          name: request.body.name,
          cardIds: request.body.cardIds,
          activate: request.body.activate
        })
      );
    } catch (error) {
      if (error instanceof CoachDeckError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  }
);

gameRouter.put(
  "/coach-decks/:id",
  requireAuth,
  validateBody(coachDeckSaveSchema),
  async (request, response) => {
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    try {
      return response.json(
        await updateCoachDeck({
          player,
          deckId: request.params.id!,
          name: request.body.name,
          cardIds: request.body.cardIds,
          activate: request.body.activate
        })
      );
    } catch (error) {
      if (error instanceof CoachDeckError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  }
);

gameRouter.post("/coach-decks/:id/activate", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  try {
    return response.json(await activateCoachDeck(player, request.params.id!));
  } catch (error) {
    if (error instanceof CoachDeckError) {
      return response.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
});

gameRouter.get("/chests", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  return response.json({
    catalog: chestPublicCatalog(),
    ...(await getChestState(player.id, player.gems))
  });
});

gameRouter.post("/chests/:id/open", requireAuth, async (request, response) => {
  const chestId = request.params.id;
  if (!chestId) return response.status(400).json({ message: "Identifiant de sac requis." });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  try {
    const result = await openChest(player.id, chestId);
    return response.json(result);
  } catch (error) {
    return response
      .status(409)
      .json({ message: error instanceof Error ? error.message : "Ouverture impossible." });
  }
});

gameRouter.post("/chests/:id/speedup", requireAuth, async (request, response) => {
  const chestId = request.params.id;
  if (!chestId) return response.status(400).json({ message: "Identifiant de sac requis." });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  try {
    const chest = await speedUpChest(player.id, chestId);
    return response.json(chest);
  } catch (error) {
    return response
      .status(409)
      .json({ message: error instanceof Error ? error.message : "Accélération impossible." });
  }
});

gameRouter.post("/cards/:statKey/unlock", requireAuth, async (request, response) => {
  const statKey = request.params.statKey;
  if (!statKey) return response.status(400).json({ message: "Carte statistique requise." });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  try {
    await unlockStatCardBonus(player.id, statKey);
    return response.json(await getChestState(player.id, player.gems));
  } catch (error) {
    return response
      .status(409)
      .json({ message: error instanceof Error ? error.message : "Déblocage impossible." });
  }
});

gameRouter.get("/skills", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  return response.json(await getPlayerSkillState(player.id));
});

gameRouter.post(
  "/skills/spend",
  requireAuth,
  validateBody(skillUpgradeSchema),
  async (request, response) => {
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    try {
      return response.json(await spendSkillPoint(player.id, request.body.statKey));
    } catch (error) {
      return response.status(409).json({
        message:
          error instanceof Error ? error.message : "Point de compétence impossible à dépenser."
      });
    }
  }
);

gameRouter.post(
  "/cosmetics/:id/equip",
  requireAuth,
  validateBody(cosmeticEquipSchema),
  async (request, response) => {
    const cosmeticId = request.params.id;
    if (!cosmeticId) return response.status(400).json({ message: "Objet cosmétique requis." });
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    try {
      const cosmetic = await equipCosmetic(player.id, cosmeticId, request.body.slotIndex);
      return response.json(cosmetic);
    } catch (error) {
      return response.status(409).json({
        message: error instanceof Error ? error.message : "Équipement impossible."
      });
    }
  }
);

gameRouter.post("/cosmetics/:id/unequip", requireAuth, async (request, response) => {
  const cosmeticId = request.params.id;
  if (!cosmeticId) return response.status(400).json({ message: "Objet cosmétique requis." });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  try {
    const cosmetic = await unequipCosmetic(player.id, cosmeticId);
    return response.json(cosmetic);
  } catch (error) {
    return response.status(409).json({
      message: error instanceof Error ? error.message : "Retrait impossible."
    });
  }
});

gameRouter.post("/cosmetics/:id/upgrade", requireAuth, async (request, response) => {
  const cosmeticId = request.params.id;
  if (!cosmeticId) return response.status(400).json({ message: "Objet cosmétique requis." });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  try {
    const cosmetic = await upgradeCosmetic(player.id, cosmeticId);
    return response.json(cosmetic);
  } catch (error) {
    return response.status(409).json({
      message: error instanceof Error ? error.message : "Amélioration impossible."
    });
  }
});

gameRouter.post(
  "/cosmetics/market/exchange",
  requireAuth,
  validateBody(cosmeticMarketSchema),
  async (request, response) => {
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    try {
      return response.json(await exchangeCosmeticsOnMarket(player.id, request.body.rarity));
    } catch (error) {
      return response.status(409).json({
        message: error instanceof Error ? error.message : "Échange impossible."
      });
    }
  }
);

gameRouter.get("/season", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const window = seasonWindow();
  const seasonKey = window.key;
  const entries = await prisma.seasonCompetitionEntry.findMany({
    where: {
      playerId: player.id,
      seasonKey,
      createdAt: {
        gte: window.startsAt,
        lt: window.endsAt
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const entryMatchIds = entries.flatMap((entry) =>
    decodeJson<Array<{ matchId: string }>>(entry.matches).map((match) => match.matchId)
  );
  const playedMatches = entryMatchIds.length
    ? await prisma.match.findMany({
        where: { id: { in: entryMatchIds } },
        include: { playerA: true, playerB: true }
      })
    : [];
  const matchById = new Map(playedMatches.map((match) => [match.id, match]));
  const serializeEntry = async (entry: (typeof entries)[number]) => {
    const rawMatches = decodeJson<Array<{ matchId: string; ranking: string; won: boolean }>>(
      entry.matches
    );
    const decodedBracket = decodeJson<TournamentBracketState>(entry.bracket);
    const bracket =
      entry.competitionType === "individual"
        ? decodedBracket
        : replayTournamentProgressForDisplay({
            bracket: decodedBracket,
            playerRanking: player.fftRanking,
            playerOverall: player.overall,
            entryId: entry.id,
            matches: rawMatches
          });
    const next = ["ELIMINE", "VAINQUEUR", "CHAMPION_NATIONAL"].includes(entry.status)
      ? null
      : nextSeasonOpponent(entry);
    const nextOpponent = next
      ? await getOrCreateSeasonOpponent(
          next.ranking,
          next.targetOverall,
          seasonOpponentSeed(entry.id, entry.currentRound),
          player.id,
          {
            excludeDailyLimitedRealOpponents: ["daily", "weekly"].includes(
              entry.competitionType
            )
          }
        )
      : null;
    return {
      ...entry,
      bracket,
      nextOpponent: nextOpponent ? publicPlayer(nextOpponent) : null,
      matches: rawMatches.map((item) => {
        const match = matchById.get(item.matchId);
        const opponent = match
          ? match.playerAId === player.id
            ? match.playerB
            : match.playerA
          : null;
        return {
          ...item,
          scoreText: match?.scoreText,
          playedAt: match?.playedAt,
          opponentName: opponent ? `${opponent.firstName} ${opponent.lastName}` : undefined,
          opponentRanking: opponent?.fftRanking ?? item.ranking
        };
      })
    };
  };
  const competitions = await Promise.all(
    (Object.values(seasonDefinitions) as SeasonDefinition[]).map(async (definition) => {
      const key = periodKey(definition.type, seasonKey, window);
      const entry = entries.find(
        (item) => item.competitionType === definition.type && item.periodKey === key
      );
      const bracket = buildSeasonBracket(definition.type, player);
      const nextAt = nextPlayableAt(definition.type, window);
      const economy = entry
        ? { entryFee: entry.entryFee, cashPrize: entry.cashPrize }
        : seasonEconomyForRanking(definition, player.fftRanking);
      return {
        ...definition,
        ...economy,
        periodKey: key,
        playableNow: !entry,
        nextPlayableAt: entry ? nextAt : null,
        currentPeriodEndsAt: nextAt,
        rankingRange:
          definition.type === "individual"
            ? { best: "-15", worst: player.fftRanking }
            : (bracket as { range: { best: FftRanking; worst: FftRanking } }).range,
        entry: entry ? await serializeEntry(entry) : null
      };
    })
  );
  return response.json({
    season: {
      key: seasonKey,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      day: window.day,
      week: window.week,
      remainingDays: window.remainingDays,
      progress: window.progress
    },
    player: publicPlayer(player),
    dailyRewards: await getSeasonDailyRewardState(player.id, window),
    competitions
  });
});

gameRouter.post("/season/rewards/daily/claim", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  try {
    return response.json(
      await claimTodaySeasonReward(request.session!.userId, player.id, seasonWindow())
    );
  } catch (error) {
    return response.status(409).json({
      message: error instanceof Error ? error.message : "Récompense impossible à récupérer."
    });
  }
});

gameRouter.post("/season/:type/register", requireAuth, async (request, response) => {
  const type = request.params.type as SeasonCompetitionType;
  const definition = seasonDefinitions[type];
  if (!definition) return response.status(400).json({ message: "Compétition inconnue." });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const window = seasonWindow();
  const seasonKey = window.key;
  const key = periodKey(type, seasonKey, window);
  const bracket = buildSeasonBracket(type, player);
  const economy = seasonEconomyForRanking(definition, player.fftRanking);
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const already = await tx.seasonCompetitionEntry.findUnique({
        where: {
          playerId_competitionType_periodKey: {
            playerId: player.id,
            competitionType: type,
            periodKey: key
          }
        }
      });
      if (already && isInSeasonWindow(already.createdAt, window))
        throw new Error("Vous êtes déjà inscrit à cette compétition pour cette période.");
      if (already) {
        await tx.seasonCompetitionEntry.delete({ where: { id: already.id } });
      }
      if (player.budget < economy.entryFee) {
        throw new Error(`Crédits insuffisants. Inscription requise : ${economy.entryFee} CR.`);
      }
      await spendCareerAction(player, tx, definition.energyCost);
      await tx.player.update({
        where: { id: player.id },
        data: { budget: { decrement: economy.entryFee } }
      });
      return tx.seasonCompetitionEntry.create({
        data: {
          playerId: player.id,
          competitionType: type,
          seasonKey,
          periodKey: key,
          label: definition.title,
          energyCost: definition.energyCost,
          entryFee: economy.entryFee,
          cashPrize: economy.cashPrize,
          bracket: encodeJson(bracket)
        }
      });
    });
    return response
      .status(201)
      .json({ ...entry, bracket: decodeJson(entry.bracket), matches: decodeJson(entry.matches) });
  } catch (error) {
    return response
      .status(409)
      .json({ message: error instanceof Error ? error.message : "Inscription impossible." });
  }
});

gameRouter.post("/season/entries/:id/play", requireAuth, async (request, response) => {
  const entryId = request.params.id;
  if (!entryId) return response.status(400).json({ message: "Inscription requise." });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const entry = await prisma.seasonCompetitionEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.playerId !== player.id)
    return response.status(404).json({ message: "Compétition introuvable." });
  if (["ELIMINE", "VAINQUEUR", "CHAMPION_NATIONAL"].includes(entry.status)) {
    return response.status(409).json({ message: "Cette compétition est terminée." });
  }
  const next = nextSeasonOpponent(entry);
  if (!next)
    return response.status(409).json({ message: "Aucun match restant dans cette compétition." });
  const opponent = await getOrCreateSeasonOpponent(
    next.ranking,
    next.targetOverall,
    seasonOpponentSeed(entry.id, entry.currentRound),
    player.id,
    {
      excludeDailyLimitedRealOpponents: ["daily", "weekly"].includes(entry.competitionType)
    }
  );
  const definition =
    seasonDefinitions[entry.competitionType as SeasonCompetitionType] ?? seasonDefinitions.daily;
  const match = await createServerMatch({
    playerAId: player.id,
    playerBId: opponent.id,
    surface: definition.surface,
    tactic: "Équilibré",
    risk: "Normale",
    format: "Deux sets gagnants",
    type: `Match officiel amateur - ${definition.title}`
  });
  const won = match.winnerId === player.id;
  const previousMatches = decodeJson<Array<{ matchId: string; ranking: string; won: boolean }>>(
    entry.matches
  );
  const nextMatches = [...previousMatches, { matchId: match.id, ranking: next.ranking, won }];
  const isIndividualFinal = entry.competitionType === "individual" && next.ranking === "-15";
  const newStatus = won
    ? isIndividualFinal
      ? "CHAMPION_NATIONAL"
      : entry.competitionType !== "individual" && entry.currentRound >= 3
        ? "VAINQUEUR"
        : "EN_COURS"
    : "ELIMINE";
  const decodedBracket = decodeJson<TournamentBracketState>(entry.bracket);
  let nextBracket: TournamentBracketState = decodedBracket;
  if (entry.competitionType !== "individual") {
    nextBracket = playTournamentRound({
      bracket: decodedBracket,
      roundIndex: entry.currentRound,
      playerRanking: player.fftRanking,
      playerOverall: player.overall,
      playerWon: won,
      playerMatchId: match.id,
      entryId: entry.id
    });
    if (!won || (won && entry.currentRound >= 3)) {
      nextBracket = completeTournamentFromRound({
        bracket: nextBracket,
        fromRound: entry.currentRound + 1,
        playerRanking: player.fftRanking,
        playerOverall: player.overall,
        entryId: entry.id
      });
    }
  }
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.seasonCompetitionEntry.update({
      where: { id: entry.id },
      data: {
        currentRound: won ? { increment: 1 } : entry.currentRound,
        status: newStatus,
        championTitle:
          newStatus === "CHAMPION_NATIONAL" ? "Champion national amateur" : entry.championTitle,
        bracket: encodeJson(nextBracket),
        matches: encodeJson(nextMatches)
      }
    });
    if (["VAINQUEUR", "CHAMPION_NATIONAL"].includes(newStatus) && entry.cashPrize > 0) {
      await tx.player.update({
        where: { id: player.id },
        data: {
          budget: { increment: entry.cashPrize },
          careerCashPrizeWon: { increment: entry.cashPrize }
        }
      });
    }
    return saved;
  });
  return response.json({
    entry: {
      ...updated,
      bracket: decodeJson(updated.bracket),
      matches: decodeJson(updated.matches)
    },
    match
  });
});

gameRouter.get("/tournaments", async (_request, response) => {
  const tournaments = await prisma.tournament.findMany({ orderBy: { startsAt: "asc" } });
  return response.json(
    tournaments.map((tournament) => ({
      ...tournament,
      bracket: decodeJson(tournament.bracket),
      schedule: decodeJson(tournament.schedule)
    }))
  );
});

gameRouter.post("/tournaments/:id/register", requireAuth, async (request, response) => {
  const tournamentId = request.params.id;
  if (!tournamentId)
    return response.status(400).json({ message: "Identifiant de tournoi requis." });
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!tournament || !player)
    return response.status(404).json({ message: "Tournoi ou joueur introuvable." });
  const dayStart = new Date(tournament.startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const already = await prisma.tournamentEntry.findFirst({
    where: { playerId: player.id, tournament: { startsAt: { gte: dayStart, lt: dayEnd } } }
  });
  if (already)
    return response
      .status(409)
      .json({ message: "Vous êtes déjà inscrit à un tournoi ce jour-là." });
  const entry = await prisma.tournamentEntry.create({
    data: { playerId: player.id, tournamentId: tournament.id }
  });
  return response.status(201).json(entry);
});

gameRouter.get("/matches", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.json([]);
  const matches = await prisma.match.findMany({
    where: { OR: [{ playerAId: player.id }, { playerBId: player.id }] },
    select: {
      id: true,
      winnerId: true,
      scoreText: true,
      type: true,
      surface: true,
      durationMinutes: true,
      playedAt: true,
      playerA: {
        select: { id: true, firstName: true, lastName: true, fftRanking: true, avatar: true }
      },
      playerB: {
        select: { id: true, firstName: true, lastName: true, fftRanking: true, avatar: true }
      }
    },
    orderBy: { playedAt: "desc" },
    take: 30
  });
  return response.json(matches);
});

gameRouter.get("/matches/duel-pool", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const pool = await buildDuelPool(player);
  return response.json({
    overallRange: duelOverallRange(player.overall),
    opponents: pool.map(publicPlayer)
  });
});

gameRouter.get("/matches/duel-search", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const query = String(request.query.q ?? "")
    .trim()
    .toLowerCase();
  if (query.length < 2) {
    return response.status(400).json({ message: "Saisissez au moins 2 caractères." });
  }
  const overallRange = duelOverallRange(player.overall);
  const dailyLimitedRealOpponentIds = await realOpponentIdsAtDailyLimit(player.id);
  const candidates = await prisma.player.findMany({
    where: {
      id: { notIn: [player.id, ...dailyLimitedRealOpponentIds] },
      isAi: false,
      overall: { gte: overallRange.min, lte: overallRange.max }
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
  const results = candidates
    .filter((candidate) =>
      `${candidate.firstName} ${candidate.lastName} ${candidate.fftRanking} ${candidate.overall}`
        .toLowerCase()
        .includes(query)
    )
    .sort(
      (left, right) =>
        Math.abs(left.overall - player.overall) - Math.abs(right.overall - player.overall) ||
        right.updatedAt.getTime() - left.updatedAt.getTime()
    )
    .slice(0, 10);
  return response.json({
    overallRange,
    results: results.map(publicPlayer)
  });
});

gameRouter.get("/matches/interactive/active", requireAuth, async (request, response) => {
  const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  return response.json(await getActiveInteractiveMatchSession(player.id));
});

gameRouter.post(
  "/matches/interactive",
  requireAuth,
  validateBody(matchRequestSchema),
  async (request, response) => {
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    const active = await getActiveInteractiveMatchSession(player.id);
    if (active) return response.json(active);

    const pool = await buildDuelPool(player);
    let opponent = request.body.opponentId
      ? pool.find((candidate) => candidate.id === request.body.opponentId)
      : pool[0];
    if (!opponent && request.body.opponentId) {
      opponent =
        (await prisma.player.findFirst({
          where: {
            id: request.body.opponentId,
            isAi: false,
            NOT: { id: player.id }
          }
        })) ?? undefined;
    }
    if (!opponent) return response.status(404).json({ message: "Adversaire introuvable." });
    if (!isWithinDuelOverallRange(player.overall, opponent.overall)) {
      const range = duelOverallRange(player.overall);
      return response.status(403).json({
        message: `La note globale de cet adversaire doit être comprise entre ${range.min} et ${range.max}.`
      });
    }
    if (!opponent.isAi) {
      const matchCount = await realOpponentMatchCountToday(player.id, opponent.id);
      if (matchCount >= 2) {
        return response.status(409).json({
          message: "Vous avez déjà affronté ce joueur réel 2 fois aujourd'hui."
        });
      }
    }

    let coachDeck: Awaited<ReturnType<typeof getCoachDeckSnapshot>>;
    try {
      coachDeck = await getCoachDeckSnapshot(player, request.body.coachDeckId);
    } catch (error) {
      if (error instanceof CoachDeckError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      console.error("Chargement du Coach Deck avant match impossible", error);
      return response.status(503).json({
        message: "Votre Coach Deck est en cours d’initialisation. Réessayez dans quelques secondes."
      });
    }

    try {
      await spendCareerAction(player);
    } catch (error) {
      return response
        .status(429)
        .json({ message: error instanceof Error ? error.message : "Énergie insuffisante." });
    }
    try {
      const result = await createInteractiveMatchSession({
        playerA: player,
        playerB: opponent,
        surface: request.body.surface ?? "Dur",
        tactic: request.body.tactic ?? "Équilibré",
        risk: request.body.risk ?? "Normale",
        format: request.body.format ?? "Deux sets gagnants",
        type: player.proUnlocked ? "Duel professionnel interactif" : "Duel amateur interactif",
        coachDeckCardIds: coachDeck.cardIds,
        coachDeckCardVariants: coachDeck.cardVariants
      });
      return response.status(result.created ? 201 : 200).json(result.session);
    } catch (error) {
      if (error instanceof InteractiveMatchSessionError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      return response.status(500).json({ message: "Création du match interactif impossible." });
    }
  }
);

gameRouter.get("/matches/interactive/:id", requireAuth, async (request, response) => {
  const sessionId = request.params.id;
  if (!sessionId) return response.status(400).json({ message: "Identifiant de session requis." });
  try {
    return response.json(await getInteractiveMatchSession(sessionId, request.session!.userId));
  } catch (error) {
    if (error instanceof InteractiveMatchSessionError) {
      return response.status(error.statusCode).json({ message: error.message });
    }
    return response.status(500).json({ message: "Impossible de charger le match interactif." });
  }
});

gameRouter.post(
  "/matches/interactive/:id/coach",
  requireAuth,
  validateBody(interactiveCoachingDecisionSchema),
  async (request, response) => {
    const sessionId = request.params.id;
    if (!sessionId) return response.status(400).json({ message: "Identifiant de session requis." });
    try {
      return response.json(
        await coachInteractiveMatchSession({
          sessionId,
          userId: request.session!.userId,
          revision: request.body.revision,
          instructionId: request.body.instructionId
        })
      );
    } catch (error) {
      if (error instanceof InteractiveMatchSessionError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      return response.status(409).json({
        message: error instanceof Error ? error.message : "Décision de coaching impossible."
      });
    }
  }
);

gameRouter.post(
  "/matches/interactive/:id/card",
  requireAuth,
  validateBody(interactiveCoachCardDecisionSchema),
  async (request, response) => {
    const sessionId = request.params.id;
    if (!sessionId) return response.status(400).json({ message: "Identifiant de session requis." });
    try {
      return response.json(
        await playCoachDeckCardSession({
          sessionId,
          userId: request.session!.userId,
          revision: request.body.revision,
          cardInstanceId: request.body.cardInstanceId,
          ...(request.body.retainInstanceId !== undefined
            ? { retainInstanceId: request.body.retainInstanceId }
            : {})
        })
      );
    } catch (error) {
      if (error instanceof InteractiveMatchSessionError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      return response.status(409).json({ message: "Décision Coach Deck impossible." });
    }
  }
);

gameRouter.post(
  "/matches/interactive/:id/abandon",
  requireAuth,
  validateBody(interactiveMatchAbandonSchema),
  async (request, response) => {
    const sessionId = request.params.id;
    if (!sessionId) return response.status(400).json({ message: "Identifiant de session requis." });
    try {
      return response.json(
        await abandonInteractiveMatchSession({
          sessionId,
          userId: request.session!.userId,
          revision: request.body.revision
        })
      );
    } catch (error) {
      if (error instanceof InteractiveMatchSessionError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      return response.status(409).json({ message: "Abandon du match impossible." });
    }
  }
);

gameRouter.post(
  "/matches/interactive/:id/feedback",
  requireAuth,
  validateBody(interactiveMatchFeedbackSchema),
  async (request, response) => {
    const sessionId = request.params.id;
    if (!sessionId) return response.status(400).json({ message: "Identifiant de session requis." });
    try {
      return response.json(
        await saveInteractiveMatchFeedback({
          sessionId,
          userId: request.session!.userId,
          balance: request.body.balance,
          enjoyment: request.body.enjoyment,
          viewport: request.body.viewport,
          comment: request.body.comment
        })
      );
    } catch (error) {
      if (error instanceof InteractiveMatchSessionError) {
        return response.status(error.statusCode).json({ message: error.message });
      }
      return response.status(500).json({ message: "Retour bêta impossible." });
    }
  }
);

gameRouter.get("/matches/:id", requireAuth, async (request, response) => {
  const matchId = request.params.id;
  if (!matchId) return response.status(400).json({ message: "Identifiant de match requis." });
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { playerA: true, playerB: true }
  });
  if (!match) return response.status(404).json({ message: "Match introuvable." });
  return response.json({
    ...match,
    playerA: publicPlayer(match.playerA),
    playerB: publicPlayer(match.playerB),
    replay: decodeJson(match.replay)
  });
});

gameRouter.post(
  "/matches/quick",
  requireAuth,
  validateBody(matchRequestSchema),
  async (request, response) => {
    const player = await prisma.player.findUnique({ where: { userId: request.session!.userId } });
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    const pool = await buildDuelPool(player);
    let opponent = request.body.opponentId
      ? pool.find((candidate) => candidate.id === request.body.opponentId)
      : pool[0];
    if (!opponent && request.body.opponentId) {
      opponent =
        (await prisma.player.findFirst({
          where: {
            id: request.body.opponentId,
            isAi: false,
            NOT: { id: player.id }
          }
        })) ?? undefined;
    }
    if (!opponent) return response.status(404).json({ message: "Adversaire introuvable." });
    if (!isWithinDuelOverallRange(player.overall, opponent.overall)) {
      const range = duelOverallRange(player.overall);
      return response.status(403).json({
        message: `La note globale de cet adversaire doit être comprise entre ${range.min} et ${range.max}.`
      });
    }
    if (!opponent.isAi) {
      const matchCount = await realOpponentMatchCountToday(player.id, opponent.id);
      if (matchCount >= 2) {
        return response.status(409).json({
          message: "Vous avez déjà affronté ce joueur réel 2 fois aujourd'hui."
        });
      }
    }
    const matchType = player.proUnlocked ? "Duel professionnel" : "Duel amateur";
    try {
      await spendCareerAction(player);
    } catch (error) {
      return response
        .status(429)
        .json({ message: error instanceof Error ? error.message : "Énergie insuffisante." });
    }
    const match = await createServerMatch({
      playerAId: player.id,
      playerBId: opponent.id,
      surface: "Dur",
      tactic: "Équilibré",
      risk: "Normale",
      format: "Deux sets gagnants",
      type: matchType
    });
    return response.status(201).json(match);
  }
);

gameRouter.post(
  "/challenges",
  requireAuth,
  validateBody(challengeSchema),
  async (request, response) => {
    const sender = await prisma.user.findUnique({
      where: { id: request.session!.userId },
      include: { player: true }
    });
    const targetPlayer = await prisma.player.findUnique({
      where: { id: request.body.targetPlayerId },
      include: { user: true }
    });
    if (!sender?.player || !targetPlayer?.userId || !targetPlayer.user) {
      return response.status(404).json({ message: "Ce joueur ne peut pas recevoir de défi PvP." });
    }
    try {
      await spendCareerAction(sender.player);
    } catch (error) {
      return response
        .status(429)
        .json({ message: error instanceof Error ? error.message : "Énergie insuffisante." });
    }
    const match = await createServerMatch({
      playerAId: sender.player.id,
      playerBId: targetPlayer.id,
      surface: "Dur",
      tactic: "Équilibré",
      risk: "Normale",
      format: "Deux sets gagnants",
      type: "Défi PvP asynchrone"
    });
    const challenge = await prisma.challenge.create({
      data: { senderId: sender.id, targetId: targetPlayer.userId, matchId: match.id }
    });
    await prisma.notification.createMany({
      data: [
        {
          userId: sender.id,
          title: "Défi joué",
          body: `Votre défi contre ${targetPlayer.firstName} est disponible.`,
          type: "defi"
        },
        {
          userId: targetPlayer.userId,
          title: "Nouveau défi",
          body: `${sender.player.firstName} vous a défié.`,
          type: "defi"
        }
      ]
    });
    return response.status(201).json({ challenge, match });
  }
);

gameRouter.get("/notifications", requireAuth, async (request, response) => {
  return response.json(
    await prisma.notification.findMany({
      where: { userId: request.session!.userId },
      orderBy: { createdAt: "desc" },
      take: 30
    })
  );
});

gameRouter.patch("/notifications/:id/read", requireAuth, async (request, response) => {
  const notificationId = request.params.id;
  if (!notificationId) return response.status(400).json({ message: "Notification invalide." });
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: request.session!.userId }
  });
  if (!notification) return response.status(404).json({ message: "Notification introuvable." });
  return response.json(
    await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() }
    })
  );
});

gameRouter.post("/notifications/read-all", requireAuth, async (request, response) => {
  await prisma.notification.updateMany({
    where: { userId: request.session!.userId, readAt: null },
    data: { readAt: new Date() }
  });
  return response.json({ ok: true });
});
