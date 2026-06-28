import bcrypt from "bcryptjs";
import { prisma } from "@mypro/database";
import { calculateOverall } from "@mypro/core";
import {
  createStatsForArchetype,
  demoTournaments,
  fftRankingMeta,
  fftRankingPath,
  type FftRanking,
  type TennisStats
} from "@mypro/sports-tennis";

const demoEmail = "demo@mypro-tennis.local";
const archetypes = [
  "Gros service",
  "Relanceur",
  "Frappeur de fond",
  "Athlète endurant",
  "Joueur complet"
];

const firstNames = [
  "Camille",
  "Noé",
  "Lina",
  "Sacha",
  "Iris",
  "Malo",
  "Nora",
  "Eden",
  "Léon",
  "Mila",
  "Oscar",
  "Zoé",
  "Nils",
  "Alya",
  "Hugo",
  "Livia",
  "Tao",
  "Romane",
  "Eli",
  "Maëlys",
  "Yanis",
  "Clara",
  "Basile",
  "Léna",
  "Adam",
  "June",
  "Robin",
  "Anouk",
  "Rafael",
  "Nina"
];

const lastNames = [
  "Varenne",
  "Silva",
  "Kovac",
  "Marin",
  "Ishikawa",
  "Serrano",
  "Delaune",
  "Okafor",
  "Massé",
  "Bergström",
  "Valcourt",
  "Mercier",
  "Noval",
  "Amini",
  "Ceylan",
  "Rossi",
  "Moretti",
  "Lang",
  "Saidi",
  "Ferrer",
  "Aubert",
  "Kimura",
  "Delmas",
  "Vega",
  "Solheim",
  "Ndiaye",
  "Costa",
  "Rey",
  "Bellerose",
  "Mendoza"
];

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? "M"}${lastName[0] ?? "P"}`.toUpperCase();
}

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

function avatarForIdentity(firstName: string, lastName: string, index: number) {
  return JSON.stringify({
    type: "picture-v1",
    initials: initials(firstName, lastName),
    picture: {
      kind: "preset",
      id: personalPictureIds[index % personalPictureIds.length] ?? "pp-01"
    }
  });
}

const genericAiFirstNames = firstNames
  .slice(0, 0)
  .concat([
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
  ]);
const genericAiLastNames = lastNames
  .slice(0, 0)
  .concat([
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
  ]);

function aiSeedIdentity(index: number) {
  return {
    firstName: genericAiFirstNames[index % genericAiFirstNames.length] ?? "Alex",
    lastName: genericAiLastNames[(index * 7 + 3) % genericAiLastNames.length] ?? "Nova"
  };
}

function rankingOverall(ranking: FftRanking) {
  const index = fftRankingPath.indexOf(ranking);
  const ratio = index / Math.max(1, fftRankingPath.length - 1);
  return Math.round(ratio * 92);
}

function statVariance(key: string, profileIndex: number) {
  const hash = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((hash + profileIndex * 7) % 9) - 4;
}

function aiStatsForRanking(
  ranking: FftRanking,
  archetype: string,
  profileIndex: number
): TennisStats {
  const archetypeStats = createStatsForArchetype(archetype);
  const target = rankingOverall(ranking);
  const stats = {} as TennisStats;
  for (const key of Object.keys(archetypeStats) as Array<keyof TennisStats>) {
    const identityBonus = Math.round((archetypeStats[key] ?? 0) * 0.9);
    stats[key] = Math.max(
      0,
      Math.min(96, target + identityBonus + statVariance(key, profileIndex))
    );
  }
  return stats;
}

function tournamentSchedule(start: Date, entrantCount: number) {
  const slots = [];
  const first = new Date(start);
  first.setHours(8, 0, 0, 0);
  for (let index = 0; index < Math.min(15, Math.max(0, entrantCount - 1)); index += 1) {
    const matchTime = new Date(first.getTime() + index * 52 * 60_000);
    if (matchTime.getHours() >= 21) break;
    slots.push({
      court: `Court ${1 + (index % 4)}`,
      round:
        index < 8 ? "Huitièmes" : index < 12 ? "Quarts" : index < 14 ? "Demi-finales" : "Finale",
      startsAt: matchTime.toISOString()
    });
  }
  return slots;
}

async function resetCareerData() {
  await prisma.challenge.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.tournamentEntry.deleteMany();
  await prisma.seasonCompetitionEntry.deleteMany();
  await prisma.fftResult.deleteMany();
  await prisma.match.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.tennisBagChest.deleteMany();
  await prisma.playerStatCard.deleteMany();
  await prisma.playerCosmetic.deleteMany();
  await prisma.player.deleteMany();
}

async function seedDemoAccount() {
  const passwordHash = await bcrypt.hash("demo1234", 12);
  await prisma.user.upsert({
    where: { email: demoEmail },
    update: { passwordHash, displayName: "Compte Démo" },
    create: { email: demoEmail, passwordHash, displayName: "Compte Démo" }
  });
}

async function seedAiPlayers() {
  const created = [];
  let worldRank = 1;
  const rankingFromBestToLowest = [...fftRankingPath].reverse();
  for (const ranking of rankingFromBestToLowest) {
    for (let slot = 0; slot < 3; slot += 1) {
      const profileIndex = worldRank - 1;
      const { firstName, lastName } = aiSeedIdentity(profileIndex);
      const archetype = archetypes[profileIndex % archetypes.length] ?? "Joueur complet";
      const stats = aiStatsForRanking(ranking, archetype, profileIndex);
      const overall = calculateOverall(stats);
      const requiredPoints = fftRankingMeta[ranking].requiredPoints;
      const player = await prisma.player.create({
        data: {
          id: `ai-${ranking.replace("/", "_").replace("-", "neg")}-${slot + 1}`,
          firstName,
          lastName,
          nationality:
            ["France", "Espagne", "Japon", "Canada", "Italie", "Suède"][profileIndex % 6] ??
            "France",
          gender: profileIndex % 2 === 0 ? "Femme" : "Homme",
          dominantHand: profileIndex % 5 === 0 ? "Gauche" : "Droite",
          backhand: profileIndex % 3 === 0 ? "Une main" : "Deux mains",
          archetype,
          avatar: avatarForIdentity(firstName, lastName, profileIndex),
          isAi: true,
          stats: JSON.stringify(stats),
          energy: Math.max(45, Math.min(96, 55 + Math.round(overall * 0.35) + (slot % 3) * 3)),
          actionEnergy: 10,
          morale: Math.max(45, Math.min(92, 58 + Math.round(overall * 0.25))),
          fatigue: Math.max(4, Math.min(38, 24 - Math.round(overall * 0.12) + slot * 2)),
          health: Math.max(70, Math.min(98, 78 + Math.round(overall * 0.18))),
          reputation: Math.max(0, Math.min(95, Math.round(overall * 0.9))),
          budget: 1200 + requiredPoints * 3 + overall * 80,
          gems: 0,
          overall,
          rankingPoints: requiredPoints + Math.max(0, (3 - slot) * 8),
          worldRank,
          fftRanking: ranking,
          fftRankingValidated: ranking === "-15",
          amateurPoints: requiredPoints,
          careerStage: ["-2/6", "-4/6", "-15"].includes(ranking) ? "Pré-pro" : "Amateur",
          proUnlocked: false,
          recentForm: Math.max(35, Math.min(88, 45 + Math.round(overall * 0.35) + slot)),
          wins: Math.max(0, Math.round(requiredPoints / 120) + slot),
          losses: Math.max(0, 18 - Math.round(overall / 8) + slot)
        }
      });
      created.push(player);
      worldRank += 1;
    }
  }
  return created;
}

async function seedTournaments(aiPlayers: Awaited<ReturnType<typeof seedAiPlayers>>) {
  const starts = [3, 9, 17];
  for (const [index, tournament] of demoTournaments.entries()) {
    const entrants = aiPlayers.slice(index * 16, index * 16 + 16).map((player) => ({
      id: player.id,
      name: `${player.firstName} ${player.lastName}`,
      ranking: player.fftRanking,
      seed: player.worldRank
    }));
    const startsAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * (starts[index] ?? 5));
    const kind = index === 0 ? "Open de club" : index === 1 ? "TMC" : "Championnat individuel";
    await prisma.tournament.upsert({
      where: { id: tournament.id },
      update: {
        kind,
        registrationDate: startsAt,
        startsAt,
        schedule: JSON.stringify(tournamentSchedule(startsAt, entrants.length)),
        bracket: JSON.stringify({
          entrants,
          rounds: ["Huitièmes", "Quarts", "Demi-finales", "Finale"]
        })
      },
      create: {
        id: tournament.id,
        name: tournament.name,
        location: tournament.location,
        surface: tournament.surface,
        category: tournament.category,
        startsAt,
        kind,
        registrationDate: startsAt,
        schedule: JSON.stringify(tournamentSchedule(startsAt, entrants.length)),
        entryFee: tournament.entryFee,
        prize: tournament.prize,
        points: tournament.points,
        playerCount: tournament.players,
        recommendedLevel: tournament.recommendedLevel,
        bracket: JSON.stringify({
          entrants,
          rounds: ["Huitièmes", "Quarts", "Demi-finales", "Finale"]
        })
      }
    });
  }
}

async function main() {
  await seedDemoAccount();
  await resetCareerData();
  const aiPlayers = await seedAiPlayers();
  await seedTournaments(aiPlayers);
  console.log(
    "Données réinitialisées : compte démo sans joueur, pyramide IA complète et tournois prêts."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
