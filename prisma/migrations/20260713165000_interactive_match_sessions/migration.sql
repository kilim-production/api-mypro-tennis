CREATE TABLE "InteractiveMatchSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "completedMatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "InteractiveMatchSession_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InteractiveMatchSession_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InteractiveMatchSession_playerAId_status_updatedAt_idx" ON "InteractiveMatchSession"("playerAId", "status", "updatedAt");
CREATE INDEX "InteractiveMatchSession_playerBId_status_updatedAt_idx" ON "InteractiveMatchSession"("playerBId", "status", "updatedAt");
