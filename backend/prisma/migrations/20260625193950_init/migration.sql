-- AlterTable
ALTER TABLE "servers" ADD COLUMN "bannerUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_dm_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dm_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dm_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "dm_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_dm_participants" ("conversationId", "id", "userId") SELECT "conversationId", "id", "userId" FROM "dm_participants";
DROP TABLE "dm_participants";
ALTER TABLE "new_dm_participants" RENAME TO "dm_participants";
CREATE UNIQUE INDEX "dm_participants_userId_conversationId_key" ON "dm_participants"("userId", "conversationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
