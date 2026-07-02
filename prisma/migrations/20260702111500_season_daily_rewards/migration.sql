CREATE TABLE "SeasonDailyRewardClaim" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "seasonKey" TEXT NOT NULL,
  "day" INTEGER NOT NULL,
  "rewardType" TEXT NOT NULL,
  "rewardValue" TEXT NOT NULL,
  "rewards" TEXT NOT NULL DEFAULT '{}',
  "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonDailyRewardClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SeasonDailyRewardClaim_playerId_seasonKey_day_key" ON "SeasonDailyRewardClaim"("playerId", "seasonKey", "day");
CREATE INDEX "SeasonDailyRewardClaim_playerId_seasonKey_idx" ON "SeasonDailyRewardClaim"("playerId", "seasonKey");
