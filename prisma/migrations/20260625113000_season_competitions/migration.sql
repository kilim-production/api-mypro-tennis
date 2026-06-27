CREATE TABLE "SeasonCompetitionEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "competitionType" TEXT NOT NULL,
  "seasonKey" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INSCRIT',
  "energyCost" INTEGER NOT NULL,
  "currentRound" INTEGER NOT NULL DEFAULT 0,
  "bracket" TEXT NOT NULL,
  "matches" TEXT NOT NULL DEFAULT '[]',
  "championTitle" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SeasonCompetitionEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SeasonCompetitionEntry_playerId_competitionType_periodKey_key" ON "SeasonCompetitionEntry"("playerId", "competitionType", "periodKey");
