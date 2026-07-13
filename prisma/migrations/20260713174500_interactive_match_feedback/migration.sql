CREATE TABLE "InteractiveMatchFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    "enjoyment" INTEGER,
    "viewport" TEXT NOT NULL DEFAULT 'OTHER',
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InteractiveMatchFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InteractiveMatchSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InteractiveMatchFeedback_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InteractiveMatchFeedback_sessionId_key" ON "InteractiveMatchFeedback"("sessionId");
CREATE INDEX "InteractiveMatchFeedback_balance_createdAt_idx" ON "InteractiveMatchFeedback"("balance", "createdAt");
CREATE INDEX "InteractiveMatchFeedback_playerId_createdAt_idx" ON "InteractiveMatchFeedback"("playerId", "createdAt");
