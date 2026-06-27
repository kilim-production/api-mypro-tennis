ALTER TABLE "Player" ADD COLUMN "fftRanking" TEXT NOT NULL DEFAULT '15/1';
ALTER TABLE "Player" ADD COLUMN "fftRankingValidated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Player" ADD COLUMN "amateurPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "careerStage" TEXT NOT NULL DEFAULT 'Amateur';
ALTER TABLE "Player" ADD COLUMN "proUnlocked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Player"
SET
  "fftRanking" = CASE
    WHEN "isAi" = true AND "overall" >= 70 THEN '-15'
    WHEN "isAi" = true AND "overall" >= 66 THEN '-4/6'
    WHEN "isAi" = true AND "overall" >= 62 THEN '-2/6'
    WHEN "isAi" = true AND "overall" >= 58 THEN '0'
    WHEN "isAi" = true AND "overall" >= 55 THEN '2/6'
    WHEN "isAi" = true AND "overall" >= 52 THEN '4/6'
    WHEN "isAi" = true AND "overall" >= 49 THEN '15'
    ELSE '15/1'
  END,
  "amateurPoints" = CASE
    WHEN "isAi" = true AND "overall" >= 70 THEN 3200
    WHEN "isAi" = true AND "overall" >= 66 THEN 2580
    WHEN "isAi" = true AND "overall" >= 62 THEN 2050
    WHEN "isAi" = true AND "overall" >= 58 THEN 1600
    WHEN "isAi" = true AND "overall" >= 55 THEN 900
    WHEN "isAi" = true AND "overall" >= 52 THEN 430
    WHEN "isAi" = true AND "overall" >= 49 THEN 120
    ELSE 0
  END,
  "careerStage" = CASE
    WHEN "isAi" = true AND "overall" >= 62 THEN 'Pré-pro'
    ELSE 'Amateur'
  END;
