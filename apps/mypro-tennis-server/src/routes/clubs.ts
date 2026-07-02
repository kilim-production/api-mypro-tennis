import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "@mypro/database";
import {
  clubCreateSchema,
  clubJoinRequestSchema,
  clubLeaveSchema,
  clubUpdateSchema
} from "@mypro/shared";
import { fftRankIndex } from "@mypro/sports-tennis";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const clubsRouter = Router();
const clubCreationCost = 5000;
const clubResaleRefund = 4000;
const teamSize = 5;
const clubComplexLevels = [
  { level: 1, name: "Club municipal", cost: 0, maxSlots: 5 },
  { level: 2, name: "Club intercommunal", cost: 10_000, maxSlots: 10 },
  { level: 3, name: "Club départemental", cost: 50_000, maxSlots: 20 },
  { level: 4, name: "Club régional", cost: 300_000, maxSlots: 35 },
  { level: 5, name: "Club de référence nationale", cost: 2_000_000, maxSlots: 50 }
] as const;
const careCenterLevels = [
  { level: 0, name: "Aucun centre de soins", cost: 0, recoveryReductionPercent: 0 },
  { level: 1, name: "Infirmerie de club", cost: 8_000, recoveryReductionPercent: 3 },
  { level: 2, name: "Cabinet de kinésithérapie", cost: 25_000, recoveryReductionPercent: 6 },
  { level: 3, name: "Pôle récupération sportive", cost: 90_000, recoveryReductionPercent: 9 },
  { level: 4, name: "Centre médico-performance", cost: 300_000, recoveryReductionPercent: 12 },
  { level: 5, name: "Institut santé haute performance", cost: 1_000_000, recoveryReductionPercent: 15 }
] as const;
const trainingCenterLevels = [
  { level: 0, name: "Aucun centre d'entraînement", cost: 0, rareChestBonusPercent: 0 },
  { level: 1, name: "Court d'entraînement encadré", cost: 12_000, rareChestBonusPercent: 1 },
  { level: 2, name: "Atelier technique vidéo", cost: 45_000, rareChestBonusPercent: 2 },
  { level: 3, name: "Académie de progression", cost: 160_000, rareChestBonusPercent: 4 },
  { level: 4, name: "Centre haute intensité", cost: 550_000, rareChestBonusPercent: 6 },
  { level: 5, name: "Académie élite MyPro", cost: 1_800_000, rareChestBonusPercent: 8 }
] as const;
const teamChampionshipDivisions = [
  "Départementale 4",
  "Départementale 3",
  "Départementale 2",
  "Départementale 1",
  "Régionale 3",
  "Régionale 2",
  "Régionale 1",
  "Nationale 4",
  "Nationale 3",
  "Nationale 2",
  "Nationale 1",
  "Elite 2",
  "Elite 1"
];
const firstTeamChampionshipDivision = teamChampionshipDivisions[0] ?? "Départementale 4";

const clubInclude = {
  president: true,
  memberships: {
    include: { player: true },
    orderBy: { joinedAt: "asc" as const }
  },
  joinRequests: {
    where: { status: "PENDING" },
    include: { player: true },
    orderBy: { createdAt: "asc" as const }
  },
  team: true
};

type ClubWithDetails = Prisma.ClubGetPayload<{ include: typeof clubInclude }>;

function playerSummary(player: ClubWithDetails["memberships"][number]["player"]) {
  return {
    id: player.id,
    name: `${player.firstName} ${player.lastName}`,
    nationality: player.nationality,
    fftRanking: player.fftRanking,
    overall: player.overall,
    worldRank: player.worldRank,
    avatar: player.avatar
  };
}

function clubComplexLevel(level: number) {
  return (
    clubComplexLevels.find((definition) => definition.level === level) ?? clubComplexLevels[0]
  );
}

function careCenterLevel(level: number) {
  return (
    careCenterLevels.find((definition) => definition.level === level) ?? careCenterLevels[0]
  );
}

function trainingCenterLevel(level: number) {
  return (
    trainingCenterLevels.find((definition) => definition.level === level) ??
    trainingCenterLevels[0]
  );
}

function clubBuildings(club: {
  complexLevel: number;
  careCenterLevel: number;
  trainingCenterLevel: number;
}) {
  const currentLevel = clubComplexLevel(club.complexLevel);
  const nextLevel = clubComplexLevels.find(
    (definition) => definition.level === currentLevel.level + 1
  );
  const currentCareLevel = careCenterLevel(club.careCenterLevel);
  const nextCareLevel = careCenterLevels.find(
    (definition) => definition.level === currentCareLevel.level + 1
  );
  const currentTrainingLevel = trainingCenterLevel(club.trainingCenterLevel);
  const nextTrainingLevel = trainingCenterLevels.find(
    (definition) => definition.level === currentTrainingLevel.level + 1
  );
  return {
    complex: {
      id: "complex",
      name: "Le complexe",
      currentLevel,
      nextLevel: nextLevel ?? null,
      maxLevel: clubComplexLevels.length,
      levels: clubComplexLevels
    },
    careCenter: {
      id: "careCenter",
      name: "Centre de soins",
      currentLevel: currentCareLevel,
      nextLevel: nextCareLevel ?? null,
      maxLevel: careCenterLevels.length - 1,
      levels: careCenterLevels
    },
    trainingCenter: {
      id: "trainingCenter",
      name: "Centre d'entraînement",
      currentLevel: currentTrainingLevel,
      nextLevel: nextTrainingLevel ?? null,
      maxLevel: trainingCenterLevels.length - 1,
      levels: trainingCenterLevels
    }
  };
}

function clubSummary(club: {
  id: string;
  name: string;
  tag: string;
  description: string;
  minimumRanking: string;
  duesAmount: number;
  budget: number;
  complexLevel: number;
  careCenterLevel: number;
  trainingCenterLevel: number;
  maxSlots: number;
  createdAt: Date;
  president: ClubWithDetails["president"];
  memberships: Array<{ playerId: string }>;
  team?: { division: string } | null;
}) {
  const competitiveLevel = club.team?.division ?? "Non engagé";
  return {
    id: club.id,
    name: club.name,
    tag: club.tag,
    description: club.description,
    minimumRanking: club.minimumRanking,
    duesAmount: club.duesAmount,
    budget: club.budget,
    complexLevel: club.complexLevel,
    careCenterLevel: club.careCenterLevel,
    trainingCenterLevel: club.trainingCenterLevel,
    buildings: clubBuildings(club),
    competitiveLevel,
    maxSlots: club.maxSlots,
    memberCount: club.memberships.length,
    openSlots: Math.max(0, club.maxSlots - club.memberships.length),
    president: playerSummary(club.president),
    createdAt: club.createdAt
  };
}

function clubDetails(club: ClubWithDetails, currentPlayerId: string) {
  return {
    ...clubSummary(club),
    isPresident: club.presidentId === currentPlayerId,
    members: club.memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      joinedAt: membership.joinedAt,
      player: playerSummary(membership.player)
    })),
    pendingRequests: club.joinRequests.map((request) => ({
      id: request.id,
      message: request.message,
      createdAt: request.createdAt,
      player: playerSummary(request.player)
    }))
  };
}

async function currentPlayer(userId: string) {
  return prisma.player.findUnique({ where: { userId } });
}

function seededHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRange(seed: string, min: number, max: number) {
  return min + (seededHash(seed) % (max - min + 1));
}

function winPercentage(player: { wins: number; losses: number }) {
  const total = player.wins + player.losses;
  return total > 0 ? player.wins / total : 0;
}

function orderPlayersForSingles<
  T extends { id: string; fftRanking: string; wins: number; losses: number }
>(players: T[], seed: string) {
  return [...players].sort((left, right) => {
    const rankingDelta = fftRankIndex(right.fftRanking) - fftRankIndex(left.fftRanking);
    if (rankingDelta !== 0) return rankingDelta;
    const winPctDelta = winPercentage(right) - winPercentage(left);
    if (winPctDelta !== 0) return winPctDelta;
    return seededHash(`${seed}-${right.id}`) - seededHash(`${seed}-${left.id}`);
  });
}

function championshipWindow(now = new Date()) {
  const start = new Date(now);
  const day = start.getDay();
  const daysUntilMonday = (8 - day) % 7;
  start.setDate(start.getDate() + daysUntilMonday);
  start.setHours(19, 0, 0, 0);
  if (daysUntilMonday === 0 && now.getTime() >= start.getTime()) {
    start.setDate(start.getDate() + 7);
  }
  const end = new Date(start);
  end.setDate(start.getDate() + 13);
  end.setHours(19, 0, 0, 0);
  return { startsAt: start, endsAt: end };
}

function roundStart(startsAt: Date, round: number) {
  const date = new Date(startsAt);
  date.setDate(startsAt.getDate() + round);
  date.setHours(18, 30, 0, 0);
  return date;
}

function nextDivision(division: string) {
  const index = teamChampionshipDivisions.indexOf(division);
  if (index < 0) return firstTeamChampionshipDivision;
  return (
    teamChampionshipDivisions[Math.min(teamChampionshipDivisions.length - 1, index + 1)] ??
    firstTeamChampionshipDivision
  );
}

function previousDivision(division: string) {
  const index = teamChampionshipDivisions.indexOf(division);
  if (index <= 0) return firstTeamChampionshipDivision;
  return teamChampionshipDivisions[index - 1] ?? firstTeamChampionshipDivision;
}

function promotedDivision(division: string) {
  const next = nextDivision(division);
  return next === division ? null : next;
}

function relegatedDivision(division: string) {
  const previous = previousDivision(division);
  return previous === division ? null : previous;
}

type TeamMeetingDetails = {
  singles?: Array<{
    homeSets?: number;
    awaySets?: number;
    homeGames?: number;
    awayGames?: number;
  }>;
};

function decodeMeetingDetails(value: string): TeamMeetingDetails {
  try {
    return JSON.parse(value) as TeamMeetingDetails;
  } catch {
    return {};
  }
}

function teamEntrySort(
  left: {
    id: string;
    points: number;
    setsFor: number;
    setsAgainst: number;
    gamesFor: number;
    gamesAgainst: number;
  },
  right: {
    id: string;
    points: number;
    setsFor: number;
    setsAgainst: number;
    gamesFor: number;
    gamesAgainst: number;
  },
  seed: string
) {
  return (
    right.points - left.points ||
    right.setsFor - right.setsAgainst - (left.setsFor - left.setsAgainst) ||
    right.gamesFor - right.gamesAgainst - (left.gamesFor - left.gamesAgainst) ||
    seededHash(`${seed}-${right.id}`) - seededHash(`${seed}-${left.id}`)
  );
}

function divisionBaseStrength(division: string) {
  const index = Math.max(0, teamChampionshipDivisions.indexOf(division));
  return 24 + index * 5;
}

function aiClubName(index: number): [string, string] {
  const names: Array<[string, string]> = [
    ["Azur", "AZR"],
    ["Nova", "NOV"],
    ["Boreal", "BOR"],
    ["Quartz", "QTZ"],
    ["Rivage", "RIV"],
    ["Atlas", "ATL"],
    ["Orion", "ORN"],
    ["Pulse", "PLS"],
    ["Vega", "VEG"],
    ["Metro", "MTR"],
    ["Cobalt", "CBL"],
    ["Vertex", "VTX"]
  ];
  return names[index] ?? [`Club ${index + 1}`, `C${index + 1}`];
}

function roundRobin(entryIds: string[]) {
  const slots: Array<string | null> = [...entryIds, null];
  const rounds: Array<Array<{ homeEntryId: string | null; awayEntryId: string | null }>> = [];
  for (let round = 0; round < slots.length - 1; round += 1) {
    const pairings: Array<{ homeEntryId: string | null; awayEntryId: string | null }> = [];
    for (let index = 0; index < slots.length / 2; index += 1) {
      const left = slots[index] ?? null;
      const right = slots[slots.length - 1 - index] ?? null;
      pairings.push({
        homeEntryId: round % 2 === 0 ? left : right,
        awayEntryId: round % 2 === 0 ? right : left
      });
    }
    rounds.push(pairings);
    const fixed = slots[0] ?? null;
    const rotating = slots.slice(1);
    const last = rotating.pop() ?? null;
    slots.splice(0, slots.length, fixed, last, ...rotating);
  }
  return rounds;
}

type TeamSinglePlayer = {
  name: string;
  fftRanking: string;
  winPct: number;
  strength: number;
  isEligible?: boolean;
};

function simulateSingleScore(winner: "home" | "away", seed: string) {
  const loserSets = seededRange(`${seed}-sets`, 0, 3) === 0 ? 1 : 0;
  const totalSets = 2 + loserSets;
  let homeSets = 0;
  let awaySets = 0;
  let homeGames = 0;
  let awayGames = 0;
  const setScores: string[] = [];
  for (let setIndex = 0; setIndex < totalSets; setIndex += 1) {
    const winnerTakesSet =
      loserSets === 0 || setIndex !== seededRange(`${seed}-lost-set`, 0, totalSets - 1);
    const setWinner = winnerTakesSet ? winner : winner === "home" ? "away" : "home";
    const loserGamesRoll = seededRange(`${seed}-games-${setIndex}`, 0, 5);
    const winnerGames = loserGamesRoll === 5 ? 7 : 6;
    const loserGames = loserGamesRoll === 5 ? 5 : loserGamesRoll;
    const homeSetGames = setWinner === "home" ? winnerGames : loserGames;
    const awaySetGames = setWinner === "away" ? winnerGames : loserGames;
    homeGames += homeSetGames;
    awayGames += awaySetGames;
    if (setWinner === "home") homeSets += 1;
    else awaySets += 1;
    setScores.push(`${homeSetGames}-${awaySetGames}`);
  }
  return {
    homeSets,
    awaySets,
    homeGames,
    awayGames,
    scoreText: setScores.join(" ")
  };
}

function aiLineup(entry: { name: string; strength: number }, seed: string) {
  return Array.from({ length: teamSize }, (_, index) => ({
    name: `${entry.name} ${index + 1}`,
    fftRanking: "IA",
    winPct: 0,
    strength: Math.max(
      1,
      entry.strength + (teamSize - index - 3) * 2 + seededRange(`${seed}-${index}`, -2, 2)
    )
  }));
}

async function entryLineup(entry: {
  id: string;
  name: string;
  strength: number;
  championshipId: string;
  teamId: string | null;
}) {
  if (!entry.teamId) return aiLineup(entry, entry.id);
  const team = await prisma.clubTeam.findUnique({
    where: { id: entry.teamId },
    include: {
      club: { include: { memberships: { include: { player: true } } } }
    }
  });
  if (!team) return aiLineup(entry, entry.id);
  let eligibleMemberships = team.club.memberships;
  if (team.club.duesAmount > 0) {
    const payments = await prisma.clubDuePayment.findMany({
      where: { clubId: team.clubId, championshipId: entry.championshipId },
      select: { playerId: true }
    });
    const paidPlayerIds = new Set(payments.map((payment) => payment.playerId));
    eligibleMemberships = eligibleMemberships.filter((membership) =>
      paidPlayerIds.has(membership.playerId)
    );
  }
  const starters = orderPlayersForSingles(
    eligibleMemberships.map((membership) => membership.player),
    `${entry.id}-${entry.championshipId}`
  )
    .slice(0, teamSize)
    .map((player) => ({
      name: `${player.firstName} ${player.lastName}`,
      fftRanking: player.fftRanking,
      winPct: winPercentage(player),
      strength: player.overall,
      isEligible: true
    }));
  while (starters.length < teamSize) {
    starters.push({
      name: `Place non éligible ${starters.length + 1}`,
      fftRanking: "Cotisation",
      winPct: 0,
      strength: 1,
      isEligible: false
    });
  }
  return starters;
}

function simulateTeamMeeting(
  home: { id: string; strength: number },
  away: { id: string; strength: number },
  seed: string,
  homeLineup: TeamSinglePlayer[],
  awayLineup: TeamSinglePlayer[]
) {
  let homeWins = 0;
  let homeSets = 0;
  let awaySets = 0;
  let homeGames = 0;
  let awayGames = 0;
  const singles = Array.from({ length: teamSize }, (_, index) => {
    const homePlayer =
      homeLineup[index] ?? aiLineup({ name: "Domicile", strength: home.strength }, seed)[index]!;
    const awayPlayer =
      awayLineup[index] ?? aiLineup({ name: "Extérieur", strength: away.strength }, seed)[index]!;
    const homeValue = homePlayer.strength + seededRange(`${seed}-h-${index}`, -9, 9);
    const awayValue = awayPlayer.strength + seededRange(`${seed}-a-${index}`, -9, 9);
    const winner = homeValue >= awayValue ? "home" : "away";
    const score = simulateSingleScore(winner, `${seed}-single-${index}`);
    if (winner === "home") homeWins += 1;
    homeSets += score.homeSets;
    awaySets += score.awaySets;
    homeGames += score.homeGames;
    awayGames += score.awayGames;
    return {
      label: `Simple ${index + 1}`,
      court: index + 1,
      homePlayer,
      awayPlayer,
      homeValue,
      awayValue,
      ...score,
      winner
    };
  });
  return {
    scoreHome: homeWins,
    scoreAway: teamSize - homeWins,
    setsHome: homeSets,
    setsAway: awaySets,
    gamesHome: homeGames,
    gamesAway: awayGames,
    details: { singles }
  };
}

async function recalculateTeamChampionshipTable(championshipId: string) {
  const [entries, meetings] = await Promise.all([
    prisma.teamChampionshipEntry.findMany({ where: { championshipId } }),
    prisma.teamChampionshipMeeting.findMany({ where: { championshipId, status: "COMPLETED" } })
  ]);
  const totals = new Map(
    entries.map((entry) => [
      entry.id,
      {
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        matchesFor: 0,
        matchesAgainst: 0,
        setsFor: 0,
        setsAgainst: 0,
        gamesFor: 0,
        gamesAgainst: 0
      }
    ])
  );
  for (const meeting of meetings) {
    if (!meeting.homeEntryId || !meeting.awayEntryId) continue;
    const home = totals.get(meeting.homeEntryId);
    const away = totals.get(meeting.awayEntryId);
    if (!home || !away) continue;
    const details = decodeMeetingDetails(meeting.details);
    const homeScore = meeting.scoreHome ?? 0;
    const awayScore = meeting.scoreAway ?? 0;
    const setsHome =
      details.singles?.reduce((sum, single) => sum + (single.homeSets ?? 0), 0) ?? 0;
    const setsAway =
      details.singles?.reduce((sum, single) => sum + (single.awaySets ?? 0), 0) ?? 0;
    const gamesHome =
      details.singles?.reduce((sum, single) => sum + (single.homeGames ?? 0), 0) ?? 0;
    const gamesAway =
      details.singles?.reduce((sum, single) => sum + (single.awayGames ?? 0), 0) ?? 0;

    home.played += 1;
    away.played += 1;
    home.wins += homeScore > awayScore ? 1 : 0;
    home.losses += homeScore > awayScore ? 0 : 1;
    away.wins += awayScore > homeScore ? 1 : 0;
    away.losses += awayScore > homeScore ? 0 : 1;
    home.points += homeScore;
    away.points += awayScore;
    home.matchesFor += homeScore;
    home.matchesAgainst += awayScore;
    away.matchesFor += awayScore;
    away.matchesAgainst += homeScore;
    home.setsFor += setsHome;
    home.setsAgainst += setsAway;
    away.setsFor += setsAway;
    away.setsAgainst += setsHome;
    home.gamesFor += gamesHome;
    home.gamesAgainst += gamesAway;
    away.gamesFor += gamesAway;
    away.gamesAgainst += gamesHome;
  }
  await prisma.$transaction(
    [...totals.entries()].map(([id, data]) =>
      prisma.teamChampionshipEntry.update({ where: { id }, data })
    )
  );
}

async function createTeamChampionship(teamId: string) {
  const team = await prisma.clubTeam.findUnique({
    where: { id: teamId },
    include: {
      club: true,
      members: { include: { player: true } }
    }
  });
  if (!team) throw new Error("Equipe introuvable.");
  const { startsAt, endsAt } = championshipWindow();
  const teamStrength = Math.round(
    team.members.reduce((sum, member) => sum + member.player.overall, 0) /
      Math.max(1, team.members.length)
  );
  const championship = await prisma.teamChampionship.create({
    data: { division: team.division, startsAt, endsAt, status: "SCHEDULED" }
  });
  const entries = [
    await prisma.teamChampionshipEntry.create({
      data: {
        championshipId: championship.id,
        teamId: team.id,
        name: team.name,
        tag: team.club.tag,
        isPlayerClub: true,
        strength: teamStrength
      }
    })
  ];
  const baseStrength = divisionBaseStrength(team.division);
  for (let index = 0; index < 12; index += 1) {
    const [name, tag] = aiClubName(index);
    entries.push(
      await prisma.teamChampionshipEntry.create({
        data: {
          championshipId: championship.id,
          name: `${name} TC`,
          tag,
          strength: Math.max(1, baseStrength + seededRange(`${championship.id}-${index}`, -6, 6))
        }
      })
    );
  }
  const rounds = roundRobin(entries.map((entry) => entry.id));
  for (const [roundIndex, pairings] of rounds.entries()) {
    for (const pairing of pairings) {
      await prisma.teamChampionshipMeeting.create({
        data: {
          championshipId: championship.id,
          round: roundIndex + 1,
          startsAt: roundStart(startsAt, roundIndex + 1),
          homeEntryId: pairing.homeEntryId,
          awayEntryId: pairing.awayEntryId,
          status: pairing.homeEntryId && pairing.awayEntryId ? "SCHEDULED" : "EXEMPT"
        }
      });
    }
  }
  return championship;
}

async function settleTeamChampionship(championshipId: string) {
  const now = new Date();
  const championship = await prisma.teamChampionship.findUnique({
    where: { id: championshipId },
    include: { entries: true, meetings: true }
  });
  if (!championship) return;
  const entriesById = new Map(championship.entries.map((entry) => [entry.id, entry]));
  const dueMeetings = championship.meetings.filter(
    (meeting) => meeting.status === "SCHEDULED" && meeting.startsAt.getTime() <= now.getTime()
  );
  for (const meeting of dueMeetings) {
    if (!meeting.homeEntryId || !meeting.awayEntryId) continue;
    const home = entriesById.get(meeting.homeEntryId);
    const away = entriesById.get(meeting.awayEntryId);
    if (!home || !away) continue;
    const result = simulateTeamMeeting(
      home,
      away,
      meeting.id,
      await entryLineup(home),
      await entryLineup(away)
    );
    const homeWon = result.scoreHome > result.scoreAway;
    await prisma.$transaction([
      prisma.teamChampionshipMeeting.update({
        where: { id: meeting.id },
        data: {
          status: "COMPLETED",
          scoreHome: result.scoreHome,
          scoreAway: result.scoreAway,
          details: JSON.stringify(result.details)
        }
      }),
      prisma.teamChampionshipEntry.update({
        where: { id: home.id },
        data: {
          played: { increment: 1 },
          wins: { increment: homeWon ? 1 : 0 },
          losses: { increment: homeWon ? 0 : 1 },
          points: { increment: result.scoreHome },
          matchesFor: { increment: result.scoreHome },
          matchesAgainst: { increment: result.scoreAway },
          setsFor: { increment: result.setsHome },
          setsAgainst: { increment: result.setsAway },
          gamesFor: { increment: result.gamesHome },
          gamesAgainst: { increment: result.gamesAway }
        }
      }),
      prisma.teamChampionshipEntry.update({
        where: { id: away.id },
        data: {
          played: { increment: 1 },
          wins: { increment: homeWon ? 0 : 1 },
          losses: { increment: homeWon ? 1 : 0 },
          points: { increment: result.scoreAway },
          matchesFor: { increment: result.scoreAway },
          matchesAgainst: { increment: result.scoreHome },
          setsFor: { increment: result.setsAway },
          setsAgainst: { increment: result.setsHome },
          gamesFor: { increment: result.gamesAway },
          gamesAgainst: { increment: result.gamesHome }
        }
      })
    ]);
  }
  await recalculateTeamChampionshipTable(championshipId);
  if (championship.status !== "COMPLETED" && championship.endsAt.getTime() <= now.getTime()) {
    const entries = (
      await prisma.teamChampionshipEntry.findMany({
        where: { championshipId }
      })
    ).sort((left, right) => teamEntrySort(left, right, championshipId));
    const winner = entries[0];
    const relegated = entries[entries.length - 1];
    await prisma.teamChampionship.update({
      where: { id: championshipId },
      data: { status: "COMPLETED" }
    });
    if (winner?.teamId) {
      const team = await prisma.clubTeam.findUnique({ where: { id: winner.teamId } });
      const division = team ? promotedDivision(team.division) : null;
      if (team && division) {
        await prisma.clubTeam.update({
          where: { id: team.id },
          data: { division }
        });
      }
    }
    if (relegated?.teamId && relegated.teamId !== winner?.teamId) {
      const team = await prisma.clubTeam.findUnique({ where: { id: relegated.teamId } });
      const division = team ? relegatedDivision(team.division) : null;
      if (team && division) {
        await prisma.clubTeam.update({
          where: { id: team.id },
          data: { division }
        });
      }
    }
  } else if (
    championship.status === "SCHEDULED" &&
    championship.startsAt.getTime() <= now.getTime()
  ) {
    await prisma.teamChampionship.update({
      where: { id: championshipId },
      data: { status: "ACTIVE" }
    });
  }
}

async function clubDuesState(params: {
  club: { id: string; duesAmount: number; memberships: Array<{ playerId: string }> };
  championship: { id: string; startsAt: Date; endsAt: Date; status: string } | null;
  currentPlayerId: string;
}) {
  if (!params.championship) {
    return {
      amount: params.club.duesAmount,
      championshipId: null,
      windowOpensAt: null,
      windowClosesAt: null,
      isWindowOpen: false,
      currentPlayerPaid: params.club.duesAmount === 0,
      currentPlayerCanPay: false,
      paidCount: params.club.duesAmount === 0 ? params.club.memberships.length : 0,
      eligibleCount: params.club.duesAmount === 0 ? params.club.memberships.length : 0,
      paidPlayerIds: [] as string[]
    };
  }
  const payments =
    params.club.duesAmount > 0
      ? await prisma.clubDuePayment.findMany({
          where: { clubId: params.club.id, championshipId: params.championship.id },
          select: { playerId: true }
        })
      : [];
  const paidPlayerIds = payments.map((payment) => payment.playerId);
  const paidSet = new Set(paidPlayerIds);
  const paymentOpen = params.championship.status !== "COMPLETED";
  const currentPlayerPaid =
    params.club.duesAmount === 0 || paidSet.has(params.currentPlayerId);
  return {
    amount: params.club.duesAmount,
    championshipId: params.championship.id,
    windowOpensAt: null,
    windowClosesAt: params.championship.endsAt,
    isWindowOpen: paymentOpen,
    currentPlayerPaid,
    currentPlayerCanPay: paymentOpen && params.club.duesAmount > 0 && !currentPlayerPaid,
    paidCount: params.club.duesAmount === 0 ? params.club.memberships.length : paidPlayerIds.length,
    eligibleCount: params.club.duesAmount === 0 ? params.club.memberships.length : paidPlayerIds.length,
    paidPlayerIds
  };
}

clubsRouter.get("/", requireAuth, async (request, response) => {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const clubs = await prisma.club.findMany({
    include: {
      president: true,
      memberships: { select: { playerId: true } },
      joinRequests: { where: { playerId: player.id }, select: { status: true } }
    },
    orderBy: [{ createdAt: "desc" }]
  });
  return response.json(
    clubs.map((club) => ({
      ...clubSummary(club),
      myRequestStatus: club.joinRequests[0]?.status ?? null
    }))
  );
});

clubsRouter.get("/me", requireAuth, async (request, response) => {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const membership = await prisma.clubMembership.findUnique({
    where: { playerId: player.id },
    include: { club: { include: clubInclude } }
  });
  const pendingRequest = await prisma.clubJoinRequest.findFirst({
    where: { playerId: player.id, status: "PENDING" },
    include: {
      club: { include: { president: true, memberships: { select: { playerId: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
  return response.json({
    club: membership ? clubDetails(membership.club, player.id) : null,
    pendingRequest: pendingRequest
      ? {
          id: pendingRequest.id,
          message: pendingRequest.message,
          createdAt: pendingRequest.createdAt,
          club: clubSummary(pendingRequest.club)
        }
      : null
  });
});

clubsRouter.get("/team-championship", requireAuth, async (request, response) => {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const membership = await prisma.clubMembership.findUnique({
    where: { playerId: player.id },
    include: {
      club: {
        include: {
          president: true,
          memberships: { include: { player: true } },
          team: {
            include: {
              members: { include: { player: true }, orderBy: { slotIndex: "asc" } }
            }
          }
        }
      }
    }
  });
  if (!membership) {
    return response.json({
      divisions: teamChampionshipDivisions,
      club: null,
      team: null,
      championship: null,
      canCreateTeam: false,
      canStartChampionship: false
    });
  }
  const club = membership.club;
  const team = club.team;
  const canCreateTeam =
    club.presidentId === player.id && !team && club.memberships.length >= teamSize;
  let currentTeam = team;
  let championship: Prisma.TeamChampionshipGetPayload<{
    include: {
      entries: true;
      meetings: {
        include: { homeEntry: true; awayEntry: true };
        orderBy: { startsAt: "asc" };
      };
    };
  }> | null = null;
  if (team) {
    const latestEntry = await prisma.teamChampionshipEntry.findFirst({
      where: { teamId: team.id },
      include: { championship: true },
      orderBy: { championship: { startsAt: "desc" } }
    });
    if (latestEntry) {
      await settleTeamChampionship(latestEntry.championshipId);
      championship = await prisma.teamChampionship.findUnique({
        where: { id: latestEntry.championshipId },
        include: {
          entries: true,
          meetings: {
            include: { homeEntry: true, awayEntry: true },
            orderBy: { startsAt: "asc" }
          }
        }
      });
    }
    currentTeam = await prisma.clubTeam.findUnique({
      where: { id: team.id },
      include: {
        members: { include: { player: true }, orderBy: { slotIndex: "asc" } }
      }
    });
  }
  const standings = championship
    ? [...championship.entries]
        .sort((left, right) => teamEntrySort(left, right, championship.id))
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
    : [];
  const nextMeeting =
    championship?.meetings.find((meeting) => meeting.status === "SCHEDULED") ?? null;
  const dues = await clubDuesState({
    club,
    championship,
    currentPlayerId: player.id
  });
  const paidPlayerIds = new Set(dues.paidPlayerIds);
  return response.json({
    divisions: teamChampionshipDivisions,
    club: clubSummary(club),
    team: currentTeam
      ? {
          id: currentTeam.id,
          name: currentTeam.name,
          division: currentTeam.division,
          members: currentTeam.members.map((member) => ({
            id: member.id,
            slotIndex: member.slotIndex,
            duesPaid: dues.amount === 0 || paidPlayerIds.has(member.player.id),
            player: playerSummary(member.player)
          }))
        }
      : null,
    championship: championship
      ? {
          id: championship.id,
          division: championship.division,
          startsAt: championship.startsAt,
          endsAt: championship.endsAt,
          status: championship.status,
          standings,
          nextMeeting,
          meetings: championship.meetings.map((meeting) => ({
            id: meeting.id,
            round: meeting.round,
            startsAt: meeting.startsAt,
            status: meeting.status,
            scoreHome: meeting.scoreHome,
            scoreAway: meeting.scoreAway,
            home: meeting.homeEntry,
            away: meeting.awayEntry,
            details: decodeMeetingDetails(meeting.details)
          }))
        }
      : null,
    dues,
    canCreateTeam,
    canStartChampionship: Boolean(team && (!championship || championship.status === "COMPLETED"))
  });
});

clubsRouter.post("/dues/pay", requireAuth, async (request, response) => {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const membership = await prisma.clubMembership.findUnique({
    where: { playerId: player.id },
    include: { club: { include: { team: true, memberships: { select: { playerId: true } } } } }
  });
  if (!membership?.club) return response.status(404).json({ message: "Vous n'avez pas de club." });
  if (!membership.club.team)
    return response.status(404).json({ message: "Aucun championnat par équipe n'est planifié." });
  if (membership.club.duesAmount <= 0)
    return response.status(400).json({ message: "Ce club n'a pas fixé de cotisation." });
  const latestEntry = await prisma.teamChampionshipEntry.findFirst({
    where: { teamId: membership.club.team.id },
    include: { championship: true },
    orderBy: { championship: { startsAt: "desc" } }
  });
  if (!latestEntry || latestEntry.championship.status === "COMPLETED")
    return response.status(404).json({ message: "Aucun prochain championnat n'est planifié." });
  await settleTeamChampionship(latestEntry.championshipId);
  const championship = await prisma.teamChampionship.findUnique({
    where: { id: latestEntry.championshipId }
  });
  if (!championship || championship.status === "COMPLETED")
    return response.status(409).json({
      message: "La cotisation n'est plus ouverte pour ce championnat."
    });
  const existing = await prisma.clubDuePayment.findUnique({
    where: {
      clubId_playerId_championshipId: {
        clubId: membership.clubId,
        playerId: player.id,
        championshipId: championship.id
      }
    }
  });
  if (existing) return response.status(409).json({ message: "Cotisation déjà payée." });
  if (player.budget < membership.club.duesAmount)
    return response.status(400).json({ message: "Budget insuffisant pour payer la cotisation." });
  const payment = await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: player.id },
      data: { budget: { decrement: membership.club.duesAmount } }
    });
    await tx.club.update({
      where: { id: membership.clubId },
      data: { budget: { increment: membership.club.duesAmount } }
    });
    return tx.clubDuePayment.create({
      data: {
        clubId: membership.clubId,
        playerId: player.id,
        championshipId: championship.id,
        amount: membership.club.duesAmount
      }
    });
  });
  return response.status(201).json({ payment });
});

clubsRouter.post("/team", requireAuth, async (request, response) => {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const membership = await prisma.clubMembership.findUnique({
    where: { playerId: player.id },
    include: { club: { include: { memberships: { include: { player: true } }, team: true } } }
  });
  if (!membership) return response.status(404).json({ message: "Vous n'avez pas encore de club." });
  if (membership.club.presidentId !== player.id)
    return response.status(403).json({ message: "Seul le président peut créer l'équipe du club." });
  if (membership.club.team)
    return response.status(409).json({ message: "Le club possède déjà une équipe." });
  if (membership.club.memberships.length < teamSize)
    return response.status(400).json({ message: "Il faut au minimum 5 joueurs dans le club." });
  const starters = orderPlayersForSingles(
    membership.club.memberships.map((membershipItem) => membershipItem.player),
    membership.clubId
  ).slice(0, teamSize);
  const team = await prisma.clubTeam.create({
    data: {
      clubId: membership.clubId,
      name: `${membership.club.name} Equipe 1`,
      division: firstTeamChampionshipDivision,
      members: {
        create: starters.map((starter, index) => ({
          playerId: starter.id,
          slotIndex: index + 1
        }))
      }
    }
  });
  const championship = await createTeamChampionship(team.id);
  return response.status(201).json({ team, championship });
});

clubsRouter.post("/team/championship", requireAuth, async (request, response) => {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const membership = await prisma.clubMembership.findUnique({
    where: { playerId: player.id },
    include: { club: { include: { team: true } } }
  });
  if (!membership?.club.team)
    return response.status(404).json({ message: "Le club n'a pas encore d'équipe." });
  if (membership.club.presidentId !== player.id)
    return response.status(403).json({ message: "Seul le président peut inscrire l'équipe." });
  const latestEntry = await prisma.teamChampionshipEntry.findFirst({
    where: { teamId: membership.club.team.id },
    include: { championship: true },
    orderBy: { championship: { startsAt: "desc" } }
  });
  if (latestEntry) {
    await settleTeamChampionship(latestEntry.championshipId);
    const latest = await prisma.teamChampionship.findUnique({
      where: { id: latestEntry.championshipId }
    });
    if (latest && latest.status !== "COMPLETED") {
      return response
        .status(409)
        .json({ message: "Un championnat est déjà en cours ou planifié." });
    }
  }
  const championship = await createTeamChampionship(membership.club.team.id);
  return response.status(201).json({ championship });
});

clubsRouter.post("/", requireAuth, validateBody(clubCreateSchema), async (request, response) => {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const existingMembership = await prisma.clubMembership.findUnique({
    where: { playerId: player.id }
  });
  if (existingMembership)
    return response.status(409).json({ message: "Vous êtes déjà membre d'un club." });
  if (player.budget < clubCreationCost)
    return response.status(400).json({
      message: `Budget insuffisant. Créer un club coûte ${clubCreationCost.toLocaleString("fr-FR")} €.`
    });
  try {
    const club = await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: player.id },
        data: { budget: { decrement: clubCreationCost } }
      });
      const created = await tx.club.create({
        data: {
          name: request.body.name,
          tag: request.body.tag,
          description: request.body.description,
          minimumRanking: request.body.minimumRanking,
          duesAmount: request.body.duesAmount,
          complexLevel: 1,
          maxSlots: 5,
          presidentId: player.id
        }
      });
      await tx.clubMembership.create({
        data: { clubId: created.id, playerId: player.id, role: "PRESIDENT" }
      });
      await tx.clubJoinRequest.updateMany({
        where: { playerId: player.id, status: "PENDING" },
        data: { status: "CANCELLED", decidedAt: new Date() }
      });
      return tx.club.findUniqueOrThrow({ where: { id: created.id }, include: clubInclude });
    });
    return response.status(201).json(clubDetails(club, player.id));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response.status(409).json({ message: "Ce nom ou ce sigle de club est déjà utilisé." });
    }
    throw error;
  }
});

clubsRouter.patch(
  "/me/settings",
  requireAuth,
  validateBody(clubUpdateSchema),
  async (request, response) => {
    const player = await currentPlayer(request.session!.userId);
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    const membership = await prisma.clubMembership.findUnique({
      where: { playerId: player.id },
      include: { club: true }
    });
    if (!membership?.club)
      return response.status(404).json({ message: "Vous n'êtes membre d'aucun club." });
    if (membership.club.presidentId !== player.id)
      return response
        .status(403)
        .json({ message: "Seul le président peut modifier les paramètres du club." });

    const club = await prisma.club.update({
      where: { id: membership.clubId },
      data: {
        description: request.body.description,
        minimumRanking: request.body.minimumRanking,
        duesAmount: request.body.duesAmount
      },
      include: clubInclude
    });
    return response.json(clubDetails(club, player.id));
  }
);

clubsRouter.post("/me/buildings/complex/upgrade", requireAuth, async (request, response) => {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const membership = await prisma.clubMembership.findUnique({
    where: { playerId: player.id },
    include: { club: true }
  });
  if (!membership?.club)
    return response.status(404).json({ message: "Vous n'êtes membre d'aucun club." });
  if (membership.club.presidentId !== player.id)
    return response
      .status(403)
      .json({ message: "Seul le président peut améliorer les infrastructures du club." });

  const currentLevel = clubComplexLevel(membership.club.complexLevel);
  const nextLevel = clubComplexLevels.find(
    (definition) => definition.level === currentLevel.level + 1
  );
  if (!nextLevel) {
    return response.status(409).json({ message: "Le Complexe est déjà au niveau maximum." });
  }
  if (membership.club.budget < nextLevel.cost) {
    return response.status(400).json({
      message: `Budget du club insuffisant. Amélioration requise : ${nextLevel.cost.toLocaleString("fr-FR")} €.`
    });
  }

  const club = await prisma.club.update({
    where: { id: membership.clubId },
    data: {
      budget: { decrement: nextLevel.cost },
      complexLevel: nextLevel.level,
      maxSlots: nextLevel.maxSlots
    },
    include: clubInclude
  });
  return response.json(clubDetails(club, player.id));
});

async function upgradeSpecializedBuilding(
  request: Request,
  response: Response,
  building: "careCenter" | "trainingCenter"
) {
  const player = await currentPlayer(request.session!.userId);
  if (!player) return response.status(404).json({ message: "Joueur introuvable." });
  const membership = await prisma.clubMembership.findUnique({
    where: { playerId: player.id },
    include: { club: true }
  });
  if (!membership?.club)
    return response.status(404).json({ message: "Vous n'êtes membre d'aucun club." });
  if (membership.club.presidentId !== player.id)
    return response
      .status(403)
      .json({ message: "Seul le président peut améliorer les infrastructures du club." });

  const levels = building === "careCenter" ? careCenterLevels : trainingCenterLevels;
  const currentLevel =
    building === "careCenter"
      ? careCenterLevel(membership.club.careCenterLevel)
      : trainingCenterLevel(membership.club.trainingCenterLevel);
  const nextLevel = levels.find((definition) => definition.level === currentLevel.level + 1);
  const label = building === "careCenter" ? "Centre de soins" : "Centre d'entraînement";
  if (!nextLevel) {
    return response.status(409).json({ message: `${label} deja au niveau maximum.` });
  }
  if (membership.club.budget < nextLevel.cost) {
    return response.status(400).json({
      message: `Budget du club insuffisant. Amelioration requise : ${nextLevel.cost.toLocaleString("fr-FR")} euros.`
    });
  }

  const data =
    building === "careCenter"
      ? { budget: { decrement: nextLevel.cost }, careCenterLevel: nextLevel.level }
      : { budget: { decrement: nextLevel.cost }, trainingCenterLevel: nextLevel.level };
  const club = await prisma.club.update({
    where: { id: membership.clubId },
    data,
    include: clubInclude
  });
  return response.json(clubDetails(club, player.id));
}

clubsRouter.post("/me/buildings/care-center/upgrade", requireAuth, async (request, response) =>
  upgradeSpecializedBuilding(request, response, "careCenter")
);

clubsRouter.post("/me/buildings/training-center/upgrade", requireAuth, async (request, response) =>
  upgradeSpecializedBuilding(request, response, "trainingCenter")
);

clubsRouter.post(
  "/me/leave",
  requireAuth,
  validateBody(clubLeaveSchema),
  async (request, response) => {
    const player = await currentPlayer(request.session!.userId);
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    const membership = await prisma.clubMembership.findUnique({
      where: { playerId: player.id },
      include: {
        club: {
          include: {
            memberships: { include: { player: true }, orderBy: { joinedAt: "asc" } },
            team: true
          }
        }
      }
    });
    if (!membership?.club)
      return response.status(404).json({ message: "Vous n'êtes membre d'aucun club." });

    const isPresident = membership.club.presidentId === player.id;
    const otherMembers = membership.club.memberships.filter((item) => item.playerId !== player.id);

    if (!isPresident) {
      await prisma.$transaction([
        prisma.clubTeamMember.deleteMany({ where: { playerId: player.id } }),
        prisma.clubMembership.delete({ where: { playerId: player.id } })
      ]);
      return response.json({
        club: null,
        pendingRequest: null,
        refunded: 0,
        message: "Vous avez quitté le club."
      });
    }

    if (otherMembers.length === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.club.delete({ where: { id: membership.clubId } });
        await tx.player.update({
          where: { id: player.id },
          data: { budget: { increment: clubResaleRefund } }
        });
      });
      return response.json({
        club: null,
        pendingRequest: null,
        refunded: clubResaleRefund,
        message: `Club revendu. ${clubResaleRefund.toLocaleString("fr-FR")} € récupérés.`
      });
    }

    const successor = otherMembers.find((item) => item.playerId === request.body.successorPlayerId);
    if (!successor) {
      return response.status(400).json({
        message: "Choisissez un membre du club pour reprendre la présidence avant de partir."
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.club.update({
        where: { id: membership.clubId },
        data: { presidentId: successor.playerId }
      });
      await tx.clubMembership.update({
        where: { playerId: successor.playerId },
        data: { role: "PRESIDENT" }
      });
      await tx.clubTeamMember.deleteMany({ where: { playerId: player.id } });
      await tx.clubMembership.delete({ where: { playerId: player.id } });
      if (successor.player.userId) {
        await tx.notification.create({
          data: {
            userId: successor.player.userId,
            title: "Nouvelle présidence de club",
            body: `Vous êtes désormais président du ${membership.club.name}.`,
            type: "CLUB"
          }
        });
      }
    });

    return response.json({
      club: null,
      pendingRequest: null,
      refunded: 0,
      message: `Vous avez quitté le club. ${successor.player.firstName} ${successor.player.lastName} devient président.`
    });
  }
);

clubsRouter.post(
  "/:id/join",
  requireAuth,
  validateBody(clubJoinRequestSchema),
  async (request, response) => {
    const clubId = request.params.id;
    if (!clubId) return response.status(400).json({ message: "Club invalide." });
    const player = await currentPlayer(request.session!.userId);
    if (!player) return response.status(404).json({ message: "Joueur introuvable." });
    const membership = await prisma.clubMembership.findUnique({ where: { playerId: player.id } });
    if (membership)
      return response.status(409).json({ message: "Vous êtes déjà membre d'un club." });
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: { memberships: true, president: true }
    });
    if (!club) return response.status(404).json({ message: "Club introuvable." });
    if (club.memberships.length >= club.maxSlots)
      return response.status(409).json({ message: "Ce club est complet." });
    if (fftRankIndex(player.fftRanking) < fftRankIndex(club.minimumRanking)) {
      return response.status(403).json({
        message: `Ce club exige le classement ${club.minimumRanking} minimum pour postuler.`
      });
    }
    const pendingElsewhere = await prisma.clubJoinRequest.findFirst({
      where: { playerId: player.id, status: "PENDING", clubId: { not: club.id } }
    });
    if (pendingElsewhere)
      return response.status(409).json({
        message: "Vous avez déjà une demande d'adhésion en attente."
      });
    const joinRequest = await prisma.clubJoinRequest.upsert({
      where: { clubId_playerId: { clubId: club.id, playerId: player.id } },
      create: {
        clubId: club.id,
        playerId: player.id,
        message: request.body.message,
        status: "PENDING"
      },
      update: {
        message: request.body.message,
        status: "PENDING",
        decidedAt: null,
        createdAt: new Date()
      }
    });
    return response.status(201).json({ request: joinRequest });
  }
);

clubsRouter.post("/requests/:id/accept", requireAuth, async (request, response) => {
  const requestId = request.params.id;
  if (!requestId) return response.status(400).json({ message: "Demande invalide." });
  const president = await currentPlayer(request.session!.userId);
  if (!president) return response.status(404).json({ message: "Joueur introuvable." });
  const joinRequest = await prisma.clubJoinRequest.findUnique({
    where: { id: requestId },
    include: { club: { include: { memberships: true } }, player: true }
  });
  if (!joinRequest || joinRequest.status !== "PENDING")
    return response.status(404).json({ message: "Demande introuvable." });
  if (joinRequest.club.presidentId !== president.id)
    return response
      .status(403)
      .json({ message: "Seul le président du club peut valider cette demande." });
  if (joinRequest.club.memberships.length >= joinRequest.club.maxSlots)
    return response.status(409).json({ message: "Ce club est complet." });
  if (fftRankIndex(joinRequest.player.fftRanking) < fftRankIndex(joinRequest.club.minimumRanking)) {
    return response.status(403).json({
      message: `Ce joueur ne respecte plus le classement minimum ${joinRequest.club.minimumRanking}.`
    });
  }
  const existingMembership = await prisma.clubMembership.findUnique({
    where: { playerId: joinRequest.playerId }
  });
  if (existingMembership)
    return response.status(409).json({ message: "Ce joueur est déjà membre d'un club." });
  const club = await prisma.$transaction(async (tx) => {
    await tx.clubMembership.create({
      data: { clubId: joinRequest.clubId, playerId: joinRequest.playerId, role: "MEMBRE" }
    });
    await tx.clubJoinRequest.update({
      where: { id: joinRequest.id },
      data: { status: "ACCEPTED", decidedAt: new Date() }
    });
    await tx.clubJoinRequest.updateMany({
      where: { playerId: joinRequest.playerId, status: "PENDING", id: { not: joinRequest.id } },
      data: { status: "CANCELLED", decidedAt: new Date() }
    });
    if (joinRequest.player.userId) {
      await tx.notification.create({
        data: {
          userId: joinRequest.player.userId,
          title: "Demande de club acceptée",
          body: `Bienvenue au ${joinRequest.club.name}.`,
          type: "CLUB"
        }
      });
    }
    return tx.club.findUniqueOrThrow({ where: { id: joinRequest.clubId }, include: clubInclude });
  });
  return response.json(clubDetails(club, president.id));
});

clubsRouter.post("/requests/:id/reject", requireAuth, async (request, response) => {
  const requestId = request.params.id;
  if (!requestId) return response.status(400).json({ message: "Demande invalide." });
  const president = await currentPlayer(request.session!.userId);
  if (!president) return response.status(404).json({ message: "Joueur introuvable." });
  const joinRequest = await prisma.clubJoinRequest.findUnique({
    where: { id: requestId },
    include: { club: true, player: true }
  });
  if (!joinRequest || joinRequest.status !== "PENDING")
    return response.status(404).json({ message: "Demande introuvable." });
  if (joinRequest.club.presidentId !== president.id)
    return response
      .status(403)
      .json({ message: "Seul le président du club peut refuser cette demande." });
  const updated = await prisma.$transaction(async (tx) => {
    await tx.clubJoinRequest.update({
      where: { id: joinRequest.id },
      data: { status: "REJECTED", decidedAt: new Date() }
    });
    if (joinRequest.player.userId) {
      await tx.notification.create({
        data: {
          userId: joinRequest.player.userId,
          title: "Demande de club refusée",
          body: `Le ${joinRequest.club.name} n'a pas validé votre demande.`,
          type: "CLUB"
        }
      });
    }
    return tx.club.findUniqueOrThrow({ where: { id: joinRequest.clubId }, include: clubInclude });
  });
  return response.json(clubDetails(updated, president.id));
});
