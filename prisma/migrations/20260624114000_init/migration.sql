CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PLAYER',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME
);

CREATE TABLE "Player" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "nationality" TEXT NOT NULL,
  "gender" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "dominantHand" TEXT NOT NULL,
  "backhand" TEXT NOT NULL,
  "archetype" TEXT NOT NULL,
  "avatar" TEXT NOT NULL,
  "isAi" BOOLEAN NOT NULL DEFAULT false,
  "stats" TEXT NOT NULL,
  "energy" REAL NOT NULL DEFAULT 82,
  "morale" REAL NOT NULL DEFAULT 70,
  "fatigue" REAL NOT NULL DEFAULT 12,
  "health" REAL NOT NULL DEFAULT 95,
  "reputation" REAL NOT NULL DEFAULT 15,
  "budget" INTEGER NOT NULL DEFAULT 5000,
  "potential" INTEGER NOT NULL DEFAULT 78,
  "overall" INTEGER NOT NULL,
  "rankingPoints" INTEGER NOT NULL DEFAULT 0,
  "worldRank" INTEGER NOT NULL DEFAULT 999,
  "recentForm" INTEGER NOT NULL DEFAULT 55,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "TrainingSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "trainingId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" DATETIME NOT NULL,
  "completedAt" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "gains" TEXT NOT NULL,
  "fatigue" REAL NOT NULL,
  "cost" INTEGER NOT NULL,
  CONSTRAINT "TrainingSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FacilityInstance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "upgradingUntil" DATETIME,
  "bonus" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacilityInstance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StaffContract" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "speciality" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "salary" INTEGER NOT NULL,
  "bonus" REAL NOT NULL,
  "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" DATETIME NOT NULL,
  CONSTRAINT "StaffContract_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Match" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerAId" TEXT NOT NULL,
  "playerBId" TEXT NOT NULL,
  "winnerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "scoreText" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "replay" TEXT NOT NULL,
  "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Match_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Match_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Tournament" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "startsAt" DATETIME NOT NULL,
  "entryFee" INTEGER NOT NULL,
  "prize" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "playerCount" INTEGER NOT NULL,
  "recommendedLevel" INTEGER NOT NULL,
  "bracket" TEXT NOT NULL
);

CREATE TABLE "Challenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "senderId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "matchId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RESOLVED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Challenge_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Challenge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");
CREATE UNIQUE INDEX "FacilityInstance_playerId_facilityId_key" ON "FacilityInstance"("playerId", "facilityId");
