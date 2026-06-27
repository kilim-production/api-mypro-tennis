import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "@mypro/database";
import { clubCreateSchema, clubJoinRequestSchema, clubUpdateSchema } from "@mypro/shared";
import { fftRankIndex } from "@mypro/sports-tennis";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const clubsRouter = Router();
const clubCreationCost = 5000;
const teamSize = 5;
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

function clubSummary(club: {
  id: string;
  name: string;
  tag: string;
  description: string;
  minimumRanking: string;
  budget: number;
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
    budget: club.budget,
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

function decodeMeetingDetails(value: string) {
  try {
    return JSON.parse(value);
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
  teamId: string | null;
}) {
  if (!entry.teamId) return aiLineup(entry, entry.id);
  const members = await prisma.clubTeamMember.findMany({
    where: { teamId: entry.teamId },
    include: { player: true },
    orderBy: { slotIndex: "asc" }
  });
  if (!members.length) return aiLineup(entry, entry.id);
  return members.map((member) => ({
    name: `${member.player.firstName} ${member.player.lastName}`,
    fftRanking: member.player.fftRanking,
    winPct: winPercentage(member.player),
    strength: member.player.overall
  }));
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
          points: { increment: homeWon ? 1 : 0 },
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
          points: { increment: homeWon ? 0 : 1 },
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
    canCreateTeam,
    canStartChampionship: Boolean(team && (!championship || championship.status === "COMPLETED"))
  });
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
        minimumRanking: request.body.minimumRanking
      },
      include: clubInclude
    });
    return response.json(clubDetails(club, player.id));
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
