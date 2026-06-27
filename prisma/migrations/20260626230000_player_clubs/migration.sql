CREATE TABLE "Club" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "maxSlots" INTEGER NOT NULL DEFAULT 5,
  "presidentId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Club_presidentId_fkey" FOREIGN KEY ("presidentId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ClubMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clubId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBRE',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClubMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ClubJoinRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clubId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "message" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" DATETIME,
  CONSTRAINT "ClubJoinRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClubJoinRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Club_name_key" ON "Club"("name");
CREATE UNIQUE INDEX "Club_tag_key" ON "Club"("tag");
CREATE INDEX "Club_presidentId_idx" ON "Club"("presidentId");
CREATE UNIQUE INDEX "ClubMembership_playerId_key" ON "ClubMembership"("playerId");
CREATE UNIQUE INDEX "ClubMembership_clubId_playerId_key" ON "ClubMembership"("clubId", "playerId");
CREATE INDEX "ClubMembership_clubId_idx" ON "ClubMembership"("clubId");
CREATE UNIQUE INDEX "ClubJoinRequest_clubId_playerId_key" ON "ClubJoinRequest"("clubId", "playerId");
CREATE INDEX "ClubJoinRequest_playerId_idx" ON "ClubJoinRequest"("playerId");
CREATE INDEX "ClubJoinRequest_status_idx" ON "ClubJoinRequest"("status");
