import "dotenv/config";
import { prisma } from "@mypro/database";
import { recalculateExistingPlayerOveralls } from "../apps/mypro-tennis-server/src/services/playerProgression";

try {
  const summary = await recalculateExistingPlayerOveralls();
  console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
} finally {
  await prisma.$disconnect();
}
