-- CreateTable
CREATE TABLE "BcStore" (
    "storeHash" TEXT NOT NULL PRIMARY KEY,
    "accessTokenEnc" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "ownerEmail" TEXT,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BcStoreUser" (
    "storeHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("storeHash", "userId")
);

-- CreateTable
CREATE TABLE "BcloudConnection" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "siteToken" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "apiKeyEnc" TEXT,
    "apiKeyLast4" TEXT,
    "syncState" TEXT NOT NULL DEFAULT 'idle',
    "syncRunId" TEXT,
    "syncStartedAt" DATETIME,
    "syncRebuiltAt" DATETIME,
    "syncHeartbeatAt" DATETIME,
    "syncFinishedAt" DATETIME,
    "syncTotal" INTEGER,
    "syncSent" INTEGER,
    "syncIndexed" INTEGER,
    "syncFailed" INTEGER,
    "syncError" TEXT
);

-- CreateTable
CREATE TABLE "BcloudAccessRequest" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "emailHint" TEXT,
    "note" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" DATETIME,
    "decidedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "BcloudConnection_clientId_key" ON "BcloudConnection"("clientId");

