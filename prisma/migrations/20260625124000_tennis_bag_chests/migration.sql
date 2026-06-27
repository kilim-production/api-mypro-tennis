-- Add gems and tennis bag chest progression.
ALTER TABLE "Player" ADD COLUMN "gems" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TennisBagChest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "rarity" TEXT NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'LOCKED',
  "unlockStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unlocksAt" DATETIME NOT NULL,
  "openedAt" DATETIME,
  "rewards" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TennisBagChest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TennisBagChest_playerId_slotIndex_key" ON "TennisBagChest"("playerId", "slotIndex");
CREATE INDEX "TennisBagChest_playerId_openedAt_idx" ON "TennisBagChest"("playerId", "openedAt");

CREATE TABLE "PlayerStatCard" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "statKey" TEXT NOT NULL,
  "copies" INTEGER NOT NULL DEFAULT 0,
  "level" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlayerStatCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlayerStatCard_playerId_statKey_key" ON "PlayerStatCard"("playerId", "statKey");

CREATE TABLE "PlayerCosmetic" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "cosmeticId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rarity" TEXT NOT NULL,
  "ownedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerCosmetic_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlayerCosmetic_playerId_cosmeticId_key" ON "PlayerCosmetic"("playerId", "cosmeticId");
