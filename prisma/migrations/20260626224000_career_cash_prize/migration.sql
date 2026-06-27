ALTER TABLE "Player" ADD COLUMN "careerCashPrizeWon" INTEGER NOT NULL DEFAULT 0;

UPDATE "Player"
SET "careerCashPrizeWon" = COALESCE(
  (
    SELECT SUM("cashPrize")
    FROM "SeasonCompetitionEntry"
    WHERE "SeasonCompetitionEntry"."playerId" = "Player"."id"
      AND "SeasonCompetitionEntry"."status" IN ('VAINQUEUR', 'CHAMPION_NATIONAL')
  ),
  0
);
