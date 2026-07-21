-- CreateTable
CREATE TABLE "ShopPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "idempotencyKey" TEXT NOT NULL,
    "paymentProvider" TEXT NOT NULL DEFAULT 'IN_GAME',
    "externalReference" TEXT,
    "rewards" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopPurchase_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerSeasonPass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerSeasonPass_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerSeasonPass_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ShopPurchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopPurchase_externalReference_key" ON "ShopPurchase"("externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPurchase_playerId_idempotencyKey_key" ON "ShopPurchase"("playerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ShopPurchase_playerId_createdAt_idx" ON "ShopPurchase"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopPurchase_status_createdAt_idx" ON "ShopPurchase"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonPass_purchaseId_key" ON "PlayerSeasonPass"("purchaseId");

-- CreateIndex
CREATE INDEX "PlayerSeasonPass_playerId_expiresAt_idx" ON "PlayerSeasonPass"("playerId", "expiresAt");
