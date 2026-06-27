ALTER TABLE "PlayerCosmetic" ADD COLUMN "bonuses" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "PlayerCosmetic" ADD COLUMN "equippedSlot" INTEGER;

CREATE UNIQUE INDEX "PlayerCosmetic_playerId_equippedSlot_key" ON "PlayerCosmetic"("playerId", "equippedSlot");
