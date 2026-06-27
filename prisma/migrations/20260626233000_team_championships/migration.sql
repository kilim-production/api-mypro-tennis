CREATE TABLE "ClubTeam" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clubId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "division" TEXT NOT NULL DEFAULT 'Departementale 4',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClubTeam_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ClubTeamMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ClubTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClubTeamMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TeamChampionship" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "division" TEXT NOT NULL,
  "startsAt" DATETIME NOT NULL,
  "endsAt" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TeamChampionshipEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "teamId" TEXT,
  "name" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "isPlayerClub" BOOLEAN NOT NULL DEFAULT false,
  "strength" INTEGER NOT NULL DEFAULT 50,
  "points" INTEGER NOT NULL DEFAULT 0,
  "played" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "matchesFor" INTEGER NOT NULL DEFAULT 0,
  "matchesAgainst" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TeamChampionshipEntry_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "TeamChampionship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamChampionshipEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ClubTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "TeamChampionshipMeeting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "round" INTEGER NOT NULL,
  "startsAt" DATETIME NOT NULL,
  "homeEntryId" TEXT,
  "awayEntryId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "scoreHome" INTEGER,
  "scoreAway" INTEGER,
  "details" TEXT NOT NULL DEFAULT '{}',
  CONSTRAINT "TeamChampionshipMeeting_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "TeamChampionship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamChampionshipMeeting_homeEntryId_fkey" FOREIGN KEY ("homeEntryId") REFERENCES "TeamChampionshipEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TeamChampionshipMeeting_awayEntryId_fkey" FOREIGN KEY ("awayEntryId") REFERENCES "TeamChampionshipEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClubTeam_clubId_key" ON "ClubTeam"("clubId");
CREATE UNIQUE INDEX "ClubTeamMember_teamId_playerId_key" ON "ClubTeamMember"("teamId", "playerId");
CREATE UNIQUE INDEX "ClubTeamMember_teamId_slotIndex_key" ON "ClubTeamMember"("teamId", "slotIndex");
CREATE INDEX "ClubTeamMember_playerId_idx" ON "ClubTeamMember"("playerId");
CREATE INDEX "TeamChampionship_division_startsAt_idx" ON "TeamChampionship"("division", "startsAt");
CREATE INDEX "TeamChampionshipEntry_championshipId_idx" ON "TeamChampionshipEntry"("championshipId");
CREATE INDEX "TeamChampionshipEntry_teamId_idx" ON "TeamChampionshipEntry"("teamId");
CREATE INDEX "TeamChampionshipMeeting_championshipId_round_idx" ON "TeamChampionshipMeeting"("championshipId", "round");
CREATE INDEX "TeamChampionshipMeeting_startsAt_idx" ON "TeamChampionshipMeeting"("startsAt");
