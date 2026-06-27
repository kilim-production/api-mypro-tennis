DROP INDEX IF EXISTS "TennisBagChest_playerId_slotIndex_key";
CREATE INDEX IF NOT EXISTS "TennisBagChest_playerId_slotIndex_idx" ON "TennisBagChest"("playerId", "slotIndex");
