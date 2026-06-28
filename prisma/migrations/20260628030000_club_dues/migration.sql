ALTER TABLE "Club" ADD COLUMN "duesAmount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ClubDuePayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clubId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "championshipId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubDuePayment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClubDuePayment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClubDuePayment_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "TeamChampionship" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClubDuePayment_clubId_playerId_championshipId_key" ON "ClubDuePayment"("clubId", "playerId", "championshipId");
CREATE INDEX "ClubDuePayment_playerId_idx" ON "ClubDuePayment"("playerId");
CREATE INDEX "ClubDuePayment_championshipId_idx" ON "ClubDuePayment"("championshipId");
