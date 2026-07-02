ALTER TABLE "TeamChampionshipEntry" ADD COLUMN "finalPosition" INTEGER;
ALTER TABLE "TeamChampionshipEntry" ADD COLUMN "cashPrize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TeamChampionshipEntry" ADD COLUMN "cashPrizeAwardedAt" DATETIME;
