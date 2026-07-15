import "dotenv/config";
import { prisma } from "@mypro/database";
import { ensureCoachDeckReady } from "../apps/mypro-tennis-server/src/services/coachDecks";

async function main() {
  const players = await prisma.player.findMany({
    where: { isAi: false, userId: { not: null } },
    orderBy: { createdAt: "asc" }
  });

  for (const player of players) {
    await ensureCoachDeckReady(player);
  }

  console.log(`${players.length} compte(s) vérifié(s) pour le Coach Deck.`);
}

main()
  .catch((error) => {
    console.error("Initialisation des Coach Decks impossible.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
