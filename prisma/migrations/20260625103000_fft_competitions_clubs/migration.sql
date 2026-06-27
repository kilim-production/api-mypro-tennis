ALTER TABLE "Tournament" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'Open de club';
ALTER TABLE "Tournament" ADD COLUMN "registrationDate" DATETIME;
ALTER TABLE "Tournament" ADD COLUMN "schedule" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Tournament" ADD COLUMN "maxEntriesPerPlayerPerDay" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "TournamentEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FftResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "matchId" TEXT,
  "competitionType" TEXT NOT NULL,
  "won" BOOLEAN NOT NULL,
  "ownRanking" TEXT NOT NULL,
  "opponentRanking" TEXT NOT NULL,
  "coefficient" REAL NOT NULL DEFAULT 1,
  "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FftResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Club" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fftCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "league" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "postalCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ClubMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ClubMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TournamentEntry_playerId_tournamentId_key" ON "TournamentEntry"("playerId", "tournamentId");
CREATE UNIQUE INDEX "Club_fftCode_key" ON "Club"("fftCode");
CREATE UNIQUE INDEX "ClubMembership_playerId_clubId_key" ON "ClubMembership"("playerId", "clubId");
