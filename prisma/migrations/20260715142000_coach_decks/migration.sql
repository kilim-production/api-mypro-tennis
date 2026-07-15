CREATE TABLE "PlayerCoachCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "masteryXp" INTEGER NOT NULL DEFAULT 0,
    "masteryLevel" INTEGER NOT NULL DEFAULT 0,
    "selectedVariant" TEXT,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerCoachCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlayerCoachCard_playerId_cardId_key" ON "PlayerCoachCard"("playerId", "cardId");
CREATE INDEX "PlayerCoachCard_playerId_masteryLevel_idx" ON "PlayerCoachCard"("playerId", "masteryLevel");

CREATE TABLE "CoachDeck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachDeck_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CoachDeck_playerId_isActive_updatedAt_idx" ON "CoachDeck"("playerId", "isActive", "updatedAt");

CREATE TABLE "CoachDeckCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deckId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "CoachDeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "CoachDeck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CoachDeckCard_deckId_position_key" ON "CoachDeckCard"("deckId", "position");
CREATE INDEX "CoachDeckCard_deckId_cardId_idx" ON "CoachDeckCard"("deckId", "cardId");
