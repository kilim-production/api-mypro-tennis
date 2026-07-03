import "dotenv/config";
import { prisma } from "@mypro/database";
import { recalculateExistingPlayerXp } from "../apps/mypro-tennis-server/src/services/playerProgression";

const summaries = await recalculateExistingPlayerXp();
const totals = summaries.reduce(
  (acc, item) => ({
    players: acc.players + 1,
    matches: acc.matches + item.matchCount,
    xp: acc.xp + item.xp,
    skillPoints: acc.skillPoints + item.skillPoints
  }),
  { players: 0, matches: 0, xp: 0, skillPoints: 0 }
);

console.log(
  JSON.stringify(
    {
      ok: true,
      ...totals,
      players: summaries.map((item) => ({
        name: item.name,
        matches: item.matchCount,
        xp: item.xp,
        level: item.level,
        skillPoints: item.skillPoints,
        spentSkillPoints: item.spentSkillPoints
      }))
    },
    null,
    2
  )
);

await prisma.$disconnect();
