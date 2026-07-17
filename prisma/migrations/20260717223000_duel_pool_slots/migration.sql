CREATE TABLE "DuelPoolSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DuelPoolSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DuelPoolSlot_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DuelPoolSlot_playerId_slotIndex_key" ON "DuelPoolSlot"("playerId", "slotIndex");
CREATE UNIQUE INDEX "DuelPoolSlot_playerId_opponentId_key" ON "DuelPoolSlot"("playerId", "opponentId");
CREATE INDEX "DuelPoolSlot_opponentId_idx" ON "DuelPoolSlot"("opponentId");
